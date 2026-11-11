import { describe, expect, it } from 'vitest';
import {encode,decode} from 'fast-png';
import jpeg from 'jpeg-js';
import {generateThumbnail, getJpegDimensions, getPngDimensions} from '../src/lib/server/thumbnail';
import {resolveCoverUrl} from '../src/lib/covers';

describe('thumbnail channel integrity',()=>{
  for(const channels of [1,2,3,4]) it(`normalizes ${channels}-channel PNG without inventing transparency`,async()=>{
    const data=new Uint8Array(600*900*channels);
    for(let p=0;p<600*900;p++)for(let c=0;c<channels;c++)data[p*channels+c]=(channels===2&&c===1)||(channels===4&&c===3)?255:120;
    const source=encode({width:600,height:900,data,channels,depth:8});
    const result=await generateThumbnail(source,'image/png');
    expect(result.resized).toBe(true);expect(result.mime).toBe('image/jpeg');
    const decoded=jpeg.decode(result.data,{useTArray:true});
    expect(decoded.width).toBe(453);expect(decoded.height).toBe(680);
    for(let i=0;i<decoded.data.length;i+=4096){expect(decoded.data[i]).toBeGreaterThan(110);expect(decoded.data[i]).toBeLessThan(130);expect(decoded.data[i+3]).toBe(255);}
  });
  it('preserves real alpha',async()=>{
    const data=new Uint8Array(600*900*4);for(let i=0;i<data.length;i+=4){data[i]=255;data[i+3]=80;}
    const result=await generateThumbnail(encode({width:600,height:900,data,channels:4}),'image/png');
    expect(result.mime).toBe('image/png');const d=decode(result.data);expect(d.data[3]).toBe(80);expect(d.data[0]).toBe(255);
  });
  it('versions thumbnail requests without changing full-size editorial media',()=>{
    expect(resolveCoverUrl('id',null,null,'thumb')).toBe('/media/id?size=thumb&v=3');
    expect(resolveCoverUrl('id')).toBe('/media/id');
  });

  it('correctly extracts JPEG dimensions even with 0xFF 0xFF fill bytes and non-payload markers', () => {
    const sampleWithFill = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x01, 0x2c, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xff, 0xd9
    ]);
    const dims = getJpegDimensions(sampleWithFill);
    expect(dims).toEqual({ width: 300, height: 400 });
  });

  it('correctly extracts PNG dimensions from IHDR chunk', () => {
    const pngBytes = encode({ width: 320, height: 480, data: new Uint8Array(320 * 480 * 4), channels: 4, depth: 8 });
    const dims = getPngDimensions(pngBytes);
    expect(dims).toEqual({ width: 320, height: 480 });
  });

  it('skips full decoding and returns resized: false when image is already within bounds', async () => {
    const sample = jpeg.encode({ data: Buffer.alloc(300 * 400 * 4), width: 300, height: 400 }, 80).data;
    const result = await generateThumbnail(sample, 'image/jpeg', { maxWidth: 480, maxHeight: 680 });
    expect(result.resized).toBe(false);
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
  });

  it('skips decoding and avoids CPU timeout when image exceeds 2MP or 1MB', async () => {
    // 1500x1500 = 2.25 MP (> 2MP)
    const largeDimsJpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0xdc, 0x05, 0xdc, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xff, 0xd9
    ]);
    const result = await generateThumbnail(largeDimsJpeg, 'image/jpeg');
    expect(result.resized).toBe(false);
    expect(result.width).toBe(1500);
    expect(result.height).toBe(1500);
  });
});

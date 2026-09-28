import { describe, expect, it } from 'vitest';
import {encode,decode} from 'fast-png';
import jpeg from 'jpeg-js';
import {generateThumbnail} from '../src/lib/server/thumbnail';
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
    expect(resolveCoverUrl('id',null,null,'thumb')).toBe('/media/id?size=thumb&v=2');
    expect(resolveCoverUrl('id')).toBe('/media/id');
  });
});

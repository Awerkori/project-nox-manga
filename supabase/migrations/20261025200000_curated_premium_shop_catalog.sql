-- =========================================================================
-- PROJECT NOX: Curated Premium Shop Catalog Overhaul
-- Removes/archives empty, broken and placeholder items.
-- Inserts high-quality, verified, aesthetic items with complete visual styles.
-- =========================================================================

-- 1. Ensure shop_items kind check accepts all valid cosmetic slots
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_kind_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_kind_check
  CHECK (kind IN ('AVATAR_FRAME', 'COMMENT_BANNER', 'PROFILE_BANNER', 'NAME_COLOR', 'TITLE', 'BADGE'));

-- 2. Archive legacy empty/broken/placeholder items
UPDATE public.shop_items
SET is_active = false, status = 'ARCHIVED'
WHERE id IN (
  'frame_basic_violet',
  'frame_basic_cyan',
  'frame_basic_emerald',
  'frame_basic_amber',
  'frame_basic_rose',
  'frame_lunar_whisper',
  'frame_shadow_runes',
  'frame_autumn_ember',
  'frame_frost_bite',
  'frame_infernal_gate',
  'frame_astral_compass',
  'frame_toxic_overdrive',
  'frame_glitch_protocol',
  'frame_singularity_gate',
  'frame_primordial_nox',
  'banner_cosmic_abyss',
  'banner_cyber_grid',
  'banner_crimson_moon',
  'banner_aurora_borealis',
  'banner_solar_flare',
  'banner_dimension_rift',
  'title_iniciado',
  'title_star_hunter',
  'title_devorador_obras',
  'title_shadow_walker',
  'title_mestre_do_abismo',
  'title_vigilante_da_meia_noite',
  'title_arcanista_celeste',
  'title_abyssal_sovereign',
  'title_entidade_infinita',
  'color_amethyst_violet',
  'color_infernal_flame',
  'color_astral_prism',
  'color_golden_sovereign',
  'color_singularity_rainbow'
);

-- 2. Upsert Curated Avatar Frames
INSERT INTO public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
VALUES
  ('frame_cosmic_nox', 'Borda Cósmica Nox', 'Anel sutil em violeta espacial com quatro gemas astrais nos pontos cardeais.', 'AVATAR_FRAME', 200, 'COMUM', false, 1, true, 'ACTIVE', 1, '', '{"border":"2px solid #a78bfa","boxShadow":"0 0 10px rgba(167, 139, 250, 0.55)","theme":"cosmic"}'::jsonb),
  ('frame_cyber_neon', 'Neon Ciano', 'Circuito cibernético com traços de neon azul elétrico e cantos chanfrados.', 'AVATAR_FRAME', 450, 'INCOMUM', false, 2, true, 'ACTIVE', 2, '', '{"border":"2px solid #06b6d4","boxShadow":"0 0 12px rgba(6, 182, 212, 0.7), inset 0 0 6px rgba(6, 182, 212, 0.3)","theme":"cyber"}'::jsonb),
  ('frame_emerald_veil', 'Véu de Esmeralda', 'Aura arcana viva em verde-esmeralda com respiração sutil de energia florestal.', 'AVATAR_FRAME', 500, 'INCOMUM', false, 3, true, 'ACTIVE', 3, '', '{"border":"2.5px solid #10b981","boxShadow":"0 0 14px rgba(16, 185, 129, 0.65), inset 0 0 5px rgba(52, 211, 153, 0.3)","theme":"emerald"}'::jsonb),
  ('frame_solar_flare', 'Chama Solar', 'Moldura dourada pulsante com rotação de chamas solares e reflexos incandescentes.', 'AVATAR_FRAME', 900, 'RARA', true, 5, true, 'ACTIVE', 4, '', '{"border":"2.5px solid #f59e0b","boxShadow":"0 0 16px rgba(245, 158, 11, 0.8)","animation":"solarRotate 4s linear infinite","theme":"solar"}'::jsonb),
  ('frame_particle_stardust', 'Poeira Estelar', 'Micro-brilhos astrais em órbita contínua em torno do avatar, inspirados no céu noturno.', 'AVATAR_FRAME', 1100, 'RARA', true, 6, true, 'ACTIVE', 5, '', '{"border":"2px solid #818cf8","boxShadow":"0 0 16px rgba(129, 140, 248, 0.75), inset 0 0 8px rgba(192, 132, 252, 0.4)","animation":"stardustTwinkle 3s ease-in-out infinite","theme":"stardust"}'::jsonb),
  ('frame_aurora_mystic', 'Aurora Boreal Mística', 'Ondulação fluida de luzes boreais em gradiente espectral dinâmico violeta, ciano e menta.', 'AVATAR_FRAME', 1800, 'EPICA', true, 10, true, 'ACTIVE', 6, '', '{"border":"3px solid #8b5cf6","boxShadow":"0 0 20px rgba(139, 92, 246, 0.8), inset 0 0 10px rgba(6, 182, 212, 0.5)","animation":"auroraWave 4s ease-in-out infinite","theme":"aurora"}'::jsonb),
  ('frame_crimson_eclipse', 'Eclipse Carmesim', 'Anel lunar vermelho profundo com corona escarlate viva e pulsação incandescente.', 'AVATAR_FRAME', 3200, 'LENDARIA', true, 15, true, 'ACTIVE', 7, '', '{"border":"3.5px solid #ef4444","boxShadow":"0 0 26px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(220, 38, 38, 0.6)","animation":"crimsonPulse 2.5s ease-in-out infinite","theme":"crimson"}'::jsonb),
  ('frame_celestial_sovereign', 'Coroa Celestial Nox', 'Diadema régio cósmico com feixes dourados e aura divina de constelações.', 'AVATAR_FRAME', 5500, 'MITICA', true, 20, true, 'ACTIVE', 8, '', '{"border":"4px solid #fbbf24","boxShadow":"0 0 32px rgba(251, 191, 36, 0.95), 0 0 16px rgba(168, 85, 247, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.8)","animation":"celestialSovereign 5s ease-in-out infinite","theme":"celestial"}'::jsonb)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  price_xp = EXCLUDED.price_xp,
  rarity = EXCLUDED.rarity,
  is_animated = EXCLUDED.is_animated,
  min_level = EXCLUDED.min_level,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  order_index = EXCLUDED.order_index,
  asset_url = EXCLUDED.asset_url,
  style_data = EXCLUDED.style_data;

-- 3. Upsert Curated Name Colors
INSERT INTO public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
VALUES
  ('color_cosmic_violet', 'Violeta Cósmico', 'Tom púrpura espacial nobre com leve luminescência astral para seu nome.', 'NAME_COLOR', 200, 'COMUM', false, 1, true, 'ACTIVE', 9, '', '{"color":"#a78bfa","textShadow":"0 0 8px rgba(167, 139, 250, 0.65)"}'::jsonb),
  ('color_neon_cyan', 'Ciano Neon', 'Azul elétrico de alta definição com destaque penetrante em qualquer fundo escuro.', 'NAME_COLOR', 200, 'COMUM', false, 1, true, 'ACTIVE', 10, '', '{"color":"#38bdf8","textShadow":"0 0 8px rgba(56, 189, 248, 0.65)"}'::jsonb),
  ('color_emerald_arcane', 'Esmeralda', 'Verde translúcido vibrante com vibração suave e excelente leitura.', 'NAME_COLOR', 400, 'INCOMUM', false, 3, true, 'ACTIVE', 11, '', '{"color":"#34d399","textShadow":"0 0 8px rgba(52, 211, 153, 0.65)"}'::jsonb),
  ('color_lunar_silver', 'Prata Lunar', 'Prata perolada límpida e refinada inspirada no brilho da lua cheia.', 'NAME_COLOR', 450, 'INCOMUM', false, 3, true, 'ACTIVE', 12, '', '{"color":"#e2e8f0","textShadow":"0 0 10px rgba(226, 232, 240, 0.7)"}'::jsonb),
  ('color_radiant_coral', 'Coral Radiante', 'Tom coral rosado incandescente com toque moderno e caloroso.', 'NAME_COLOR', 800, 'RARA', false, 5, true, 'ACTIVE', 13, '', '{"color":"#fb7185","textShadow":"0 0 10px rgba(251, 113, 133, 0.7)"}'::jsonb),
  ('color_solar_gold', 'Dourado Solar', 'Ouro radiante das estrelas com halo luminoso nobre.', 'NAME_COLOR', 1500, 'EPICA', false, 8, true, 'ACTIVE', 14, '', '{"color":"#fbbf24","textShadow":"0 0 12px rgba(251, 191, 36, 0.8), 0 0 4px #f59e0b"}'::jsonb),
  ('color_prism_gradient', 'Prisma Cósmico', 'Gradiente animado de três tons (violeta, ciano e ouro) com reflexo luminoso dinâmico.', 'NAME_COLOR', 3000, 'LENDARIA', true, 12, true, 'ACTIVE', 15, '', '{"color":"#c084fc","backgroundImage":"linear-gradient(90deg, #c084fc 0%, #38bdf8 50%, #fbbf24 100%)","textShadow":"0 0 14px rgba(192, 132, 252, 0.7)"}'::jsonb)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  price_xp = EXCLUDED.price_xp,
  rarity = EXCLUDED.rarity,
  is_animated = EXCLUDED.is_animated,
  min_level = EXCLUDED.min_level,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  order_index = EXCLUDED.order_index,
  asset_url = EXCLUDED.asset_url,
  style_data = EXCLUDED.style_data;

-- 4. Upsert Curated Cosmic Titles
INSERT INTO public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
VALUES
  ('title_viajante_estelar', 'Viajante Estelar', 'Dado aos primeiros passos na imensidão do cosmos e do catálogo Nox.', 'TITLE', 150, 'COMUM', false, 1, true, 'ACTIVE', 16, '', '{"color":"#a78bfa","badgeBorder":"rgba(167, 139, 250, 0.4)","badgeBg":"rgba(167, 139, 250, 0.12)"}'::jsonb),
  ('title_guardiao_do_vazio', 'Guardião do Vazio', 'Para leitores firmes que navegam destemidos pelas correntes misteriosas entre mundos.', 'TITLE', 450, 'INCOMUM', false, 3, true, 'ACTIVE', 17, '', '{"color":"#38bdf8","badgeBorder":"rgba(56, 189, 248, 0.4)","badgeBg":"rgba(56, 189, 248, 0.12)"}'::jsonb),
  ('title_leitor_celestial', 'Leitor Celestial', 'Alcançou o cume das constelações de histórias mais aclamadas da comunidade.', 'TITLE', 900, 'RARA', false, 6, true, 'ACTIVE', 18, '', '{"color":"#34d399","badgeBorder":"rgba(52, 211, 153, 0.4)","badgeBg":"rgba(52, 211, 153, 0.12)"}'::jsonb),
  ('title_arquiteto_constelacoes', 'Arquiteto de Constelações', 'Mapeador incansável de obras-primas e construtor de jornadas épicas.', 'TITLE', 1800, 'EPICA', false, 10, true, 'ACTIVE', 19, '', '{"color":"#c084fc","badgeBorder":"rgba(192, 132, 252, 0.45)","badgeBg":"rgba(192, 132, 252, 0.15)"}'::jsonb),
  ('title_soberano_estrelas', 'Soberano das Estrelas', 'Presença régia respeitada, cujo gosto guia as luzes mais brilhantes do firmamento.', 'TITLE', 3500, 'LENDARIA', false, 16, true, 'ACTIVE', 20, '', '{"color":"#fbbf24","badgeBorder":"rgba(251, 191, 36, 0.5)","badgeBg":"rgba(251, 191, 36, 0.15)"}'::jsonb),
  ('title_lenda_do_nox', 'Lenda do Nox', 'O título supremo reservado aos ícones eternos gravados nos anais da plataforma.', 'TITLE', 6000, 'MITICA', true, 22, true, 'ACTIVE', 21, '', '{"color":"#f43f5e","textShadow":"0 0 10px #f43f5e, 0 0 20px #fbbf24","badgeBorder":"rgba(244, 63, 94, 0.6)","badgeBg":"rgba(244, 63, 94, 0.18)"}'::jsonb)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  price_xp = EXCLUDED.price_xp,
  rarity = EXCLUDED.rarity,
  is_animated = EXCLUDED.is_animated,
  min_level = EXCLUDED.min_level,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  order_index = EXCLUDED.order_index,
  asset_url = EXCLUDED.asset_url,
  style_data = EXCLUDED.style_data;

-- 5. Upsert Curated Profile Banners
INSERT INTO public.shop_items(id, name, description, kind, price_xp, rarity, is_animated, min_level, is_active, status, order_index, asset_url, style_data)
VALUES
  ('banner_nebulosa_vazio', 'Nebulosa do Vazio', 'Nuvem cósmica de poeira estelar violeta e azul profundo com constelações distantes.', 'PROFILE_BANNER', 300, 'COMUM', false, 2, true, 'ACTIVE', 22, '', '{"background":"radial-gradient(ellipse at 70% 30%, rgba(139, 92, 246, 0.45) 0%, rgba(15, 12, 38, 0.95) 75%), linear-gradient(135deg, #090814 0%, #171033 50%, #06050d 100%)"}'::jsonb),
  ('banner_aurora_astral', 'Aurora Astral', 'Cortinas de luz etérea em ondas esmeralda e turquesa sobre a escuridão do espaço.', 'PROFILE_BANNER', 600, 'INCOMUM', false, 4, true, 'ACTIVE', 23, '', '{"background":"radial-gradient(ellipse at 30% 20%, rgba(16, 185, 129, 0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.35) 0%, transparent 60%), linear-gradient(135deg, #041217 0%, #062326 50%, #020a0d 100%)"}'::jsonb),
  ('banner_energia_arcana', 'Energia Arcana', 'Vórtices de feitiçaria cósmica pulsando em tons de ametista e safira etérea.', 'PROFILE_BANNER', 1000, 'RARA', false, 7, true, 'ACTIVE', 24, '', '{"background":"radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.4) 0%, rgba(30, 27, 75, 0.8) 55%, #070712 100%), linear-gradient(90deg, #1e1b4b 0%, #311042 100%)"}'::jsonb),
  ('banner_eclipse_cosmico', 'Eclipse Cósmico', 'Corona solar em eclipse total com anel de fogo rubi emergindo sobre o vazio.', 'PROFILE_BANNER', 1800, 'EPICA', false, 10, true, 'ACTIVE', 25, '', '{"background":"radial-gradient(circle at 65% 50%, rgba(239, 68, 68, 0.5) 0%, rgba(185, 28, 28, 0.3) 35%, transparent 70%), linear-gradient(135deg, #1c0508 0%, #2b080d 50%, #0d0204 100%)"}'::jsonb),
  ('banner_biblioteca_estrelas', 'Biblioteca das Estrelas', 'Padrões geométricos áureos e constelações gravadas na tapeçaria estelar.', 'PROFILE_BANNER', 3200, 'LENDARIA', false, 15, true, 'ACTIVE', 26, '', '{"background":"radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.35) 0%, transparent 65%), linear-gradient(135deg, #171104 0%, #2e2007 50%, #0d0a02 100%)"}'::jsonb),
  ('banner_runas_primordiais', 'Fenda Rúnica', 'Glifos arcanos ancestrais em ciano e púrpura flutuando numa fenda dimensional profunda.', 'PROFILE_BANNER', 5000, 'MITICA', true, 20, true, 'ACTIVE', 27, '', '{"background":"radial-gradient(circle at 25% 40%, rgba(192, 132, 252, 0.45) 0%, transparent 50%), radial-gradient(circle at 75% 60%, rgba(56, 189, 248, 0.4) 0%, transparent 50%), linear-gradient(135deg, #110524 0%, #07192e 50%, #04020a 100%)"}'::jsonb)
ON CONFLICT(id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  price_xp = EXCLUDED.price_xp,
  rarity = EXCLUDED.rarity,
  is_animated = EXCLUDED.is_animated,
  min_level = EXCLUDED.min_level,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  order_index = EXCLUDED.order_index,
  asset_url = EXCLUDED.asset_url,
  style_data = EXCLUDED.style_data;

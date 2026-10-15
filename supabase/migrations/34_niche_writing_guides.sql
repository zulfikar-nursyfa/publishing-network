-- Writing guides per niche and language: editorial instructions added to the research and draft
-- prompts of every website in the niche (English sites use guide_en, Arabic sites guide_ar).
-- Admin-written, so they are trusted instructions, unlike source material.

alter table public.niches
  add column guide_en text check (char_length(guide_en) <= 3000),
  add column guide_ar text check (char_length(guide_ar) <= 3000);

update public.niches set
  guide_en = 'Readers are business owners, investors and professionals in the UAE and the wider Gulf. Lead with what happened and why it matters for the regional economy, companies or investors. Give figures with their currency and period (for example AED 1.2 billion in the first half of 2026). Explain deals, regulations and market moves in plain terms. Neutral, factual tone: no hype, no predictions of prices or returns, no buy or sell suggestions.',
  guide_ar = 'القراء رجال وسيدات أعمال ومستثمرون ومهنيون في الإمارات والخليج. ابدأ بما حدث ولماذا يهم الاقتصاد الإقليمي أو الشركات أو المستثمرين. اذكر الأرقام مع العملة والفترة (مثل 1.2 مليار درهم في النصف الأول من 2026). اشرح الصفقات والأنظمة وتحركات الأسواق بلغة واضحة. أسلوب محايد قائم على الحقائق: بلا مبالغة، ولا توقعات للأسعار أو العوائد، ولا توصيات بالشراء أو البيع.'
where slug = 'business-investment' and guide_en is null and guide_ar is null;

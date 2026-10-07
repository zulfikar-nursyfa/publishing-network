-- gemini-2.5-flash is no longer available to new API users; gemini-3.8-flash is the default.
-- Standard paid prices from https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-07; input and
-- output double on 2027-01-01). Search: $14 per 1,000 after 5,000 free requests a month, so an upper estimate.
insert into public.ai_model_prices (model, input_per_million_usd, output_per_million_usd, search_per_thousand_usd)
values ('gemini-3.8-flash', 0.75, 3.75, 14)
on conflict (model) do update set input_per_million_usd = excluded.input_per_million_usd,
  output_per_million_usd = excluded.output_per_million_usd, search_per_thousand_usd = excluded.search_per_thousand_usd, updated_at = now();

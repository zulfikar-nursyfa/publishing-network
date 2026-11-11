-- A website can be set up and start drafting before its WordPress site exists. No URL means
-- "not connected"; publishing already refuses websites without a working connection.
alter table public.websites
  alter column wp_base_url drop not null,
  alter column wp_username drop not null,
  add constraint websites_wordpress_complete check ((wp_base_url is null) = (wp_username is null));

insert into public.credit_packages (id, credits, base_price_cents)
values ('starter', 15, 499), ('standard', 40, 999), ('large', 100, 1999)
on conflict (id) do nothing;

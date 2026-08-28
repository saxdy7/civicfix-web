-- Seed reference data. Safe to re-run.

insert into public.departments (name, categories, sla_hours) values
  ('Streets & Roads', array['pothole']::issue_category[], 72),
  ('Sanitation',      array['garbage']::issue_category[], 48),
  ('Utilities',       array['streetlight']::issue_category[], 96),
  ('General Services',array['other']::issue_category[], 120)
on conflict (name) do nothing;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['doctor_profiles', 'doctors', 'profiles']
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I add column if not exists plan text not null default %L', target_table, 'Basic');
      execute format('alter table public.%I add column if not exists ai_enabled boolean not null default false', target_table);
      execute format('alter table public.%I add column if not exists token_limit integer not null default 0', target_table);
      execute format('alter table public.%I add column if not exists token_used integer not null default 0', target_table);
      execute format('alter table public.%I add column if not exists is_ai_paused boolean not null default false', target_table);

      execute format(
        'update public.%I set plan = case when lower(coalesce(plan, %L)) like %L then %L when lower(coalesce(plan, %L)) like %L then %L when lower(coalesce(plan, %L)) like %L then %L else %L end, ai_enabled = coalesce(ai_enabled, false), token_limit = coalesce(token_limit, 0), token_used = coalesce(token_used, 0), is_ai_paused = coalesce(is_ai_paused, false)',
        target_table,
        'Basic',
        '%multi%',
        'Multi-Specialty',
        'Basic',
        '%growth%',
        'Growth',
        'Basic',
        '%basic%',
        'Basic',
        'Basic'
      );

      if not exists (
        select 1
        from pg_constraint
        where conname = format('%s_plan_check', target_table)
          and conrelid = format('public.%I', target_table)::regclass
      ) then
        execute format(
          'alter table public.%I add constraint %I check (plan in (%L, %L, %L))',
          target_table,
          format('%s_plan_check', target_table),
          'Basic',
          'Growth',
          'Multi-Specialty'
        );
      end if;
    end if;
  end loop;
end $$;

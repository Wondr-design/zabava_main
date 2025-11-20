-- Store partner notes as structured JSON entries
alter table if exists public.partners
  alter column notes type jsonb
  using (
    case
      when notes is null or btrim(notes) = '' then '[]'::jsonb
      when notes ~ '^\s*\{' or notes ~ '^\s*\[' then notes::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'body', notes,
          'createdAt', now()::text
        )
      )
    end
  );

alter table if exists public.partners
  alter column notes set default '[]'::jsonb;
 
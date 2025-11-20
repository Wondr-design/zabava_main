create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null,
  code text not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_verifications_email_purpose_unique unique (email, purpose),
  constraint email_verifications_code_length check (char_length(code) between 4 and 12)
);

create index if not exists email_verifications_email_idx on email_verifications (email);
create index if not exists email_verifications_purpose_idx on email_verifications (purpose);
create index if not exists email_verifications_expires_at_idx on email_verifications (expires_at);

create trigger email_verifications_updated_at
  before update on email_verifications
  for each row
  execute procedure update_updated_at_column();

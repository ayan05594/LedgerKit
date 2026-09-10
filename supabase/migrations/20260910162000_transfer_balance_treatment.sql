alter table public.transfers
  add column if not exists balance_treatment text not null default 'none';

-- Translate legacy intent without turning an unmatched repayment into a debt.
update public.transfers
set balance_treatment = case
  when counts_as_spend or purpose in ('gift', 'salary', 'other') then 'none'
  when direction = 'sent' and purpose = 'loan' then 'creates_receivable'
  when direction = 'received' and purpose = 'loan' then 'creates_payable'
  when direction = 'sent' and purpose = 'repayment' then 'settles_payable'
  when direction = 'received' and purpose = 'repayment' then 'settles_receivable'
  when direction = 'sent' then 'creates_receivable'
  else 'settles_receivable'
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfers_balance_treatment_check'
      and conrelid = 'public.transfers'::regclass
  ) then
    alter table public.transfers
      add constraint transfers_balance_treatment_check
      check (
        balance_treatment in (
          'creates_receivable',
          'settles_receivable',
          'creates_payable',
          'settles_payable',
          'none'
        )
      );
  end if;
end
$$;

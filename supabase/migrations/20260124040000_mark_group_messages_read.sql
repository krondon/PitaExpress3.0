create or replace function public.mark_group_messages_read(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
    update chat_messages
    set read = true
    where group_id = p_group_id
      and sender_id <> p_user_id
      and read = false;
end;
$$;

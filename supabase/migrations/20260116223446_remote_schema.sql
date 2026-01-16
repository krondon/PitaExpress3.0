drop trigger if exists "trg_set_updated_at" on "public"."business_config";

drop trigger if exists "chat_messages_updated_at" on "public"."chat_messages";

drop trigger if exists "chat_typing_updated_at" on "public"."chat_typing_status";

drop trigger if exists "order_reviews_updated_at" on "public"."order_reviews";

drop trigger if exists "assign_order_on_insert" on "public"."orders";

drop trigger if exists "set_elapsed_time" on "public"."orders";

drop trigger if exists "tr_order_state_change" on "public"."orders";

drop trigger if exists "trg_set_orders_updated_at" on "public"."orders";

drop trigger if exists "trigger_update_max_state" on "public"."orders";

drop trigger if exists "trigger_update_product_alternatives_updated_at" on "public"."product_alternatives";

drop trigger if exists "trigger_update_tickets_updated_at" on "public"."tickets";

drop trigger if exists "manage_user_roles_trigger" on "public"."userlevel";

drop trigger if exists "trg_userlevel_set_updated_at" on "public"."userlevel";

drop trigger if exists "update_employee_user_level" on "public"."userlevel";

drop policy "admins_delete_administrators_v3" on "public"."administrators";

drop policy "admins_insert_administrators_v3" on "public"."administrators";

drop policy "admins_select_administrators_v3" on "public"."administrators";

drop policy "admins_update_administrators_v3" on "public"."administrators";

drop policy "admins_select_api_health_logs" on "public"."api_health_logs";

drop policy "employees_manage_boxes_optimized" on "public"."boxes";

drop policy "admins_manage_business_config" on "public"."business_config";

drop policy "admins_delete_clients_v3" on "public"."clients";

drop policy "admins_insert_clients_v3" on "public"."clients";

drop policy "admins_update_clients_v3" on "public"."clients";

drop policy "employees_manage_containers_optimized" on "public"."containers";

drop policy "admins_delete_employees_v3" on "public"."employees";

drop policy "admins_insert_employees_v3" on "public"."employees";

drop policy "admins_update_employees_v3" on "public"."employees";

drop policy "admins_delete_reviews" on "public"."order_reviews";

drop policy "clients_insert_reviews" on "public"."order_reviews";

drop policy "users_select_reviews" on "public"."order_reviews";

drop policy "users_update_reviews" on "public"."order_reviews";

drop policy "users_view_order_history" on "public"."order_state_history";

drop policy "admins_full_access" on "public"."orders";

drop policy "china_employees_select_orders" on "public"."orders";

drop policy "china_employees_update_orders" on "public"."orders";

drop policy "clients_insert_orders" on "public"."orders";

drop policy "pagos_select_orders" on "public"."orders";

drop policy "pagos_update_order_state" on "public"."orders";

drop policy "vzla_employees_select_orders" on "public"."orders";

drop policy "vzla_employees_update_orders" on "public"."orders";

drop policy "Admins can insert print history" on "public"."print_history";

drop policy "Admins can view print history" on "public"."print_history";

drop policy "clients_update_alternatives" on "public"."product_alternatives";

drop policy "employees_insert_alternatives" on "public"."product_alternatives";

drop policy "users_select_alternatives" on "public"."product_alternatives";

drop policy "Admins can delete tickets" on "public"."tickets";

drop policy "Admins can insert tickets" on "public"."tickets";

drop policy "Admins can update tickets" on "public"."tickets";

drop policy "Admins can view all tickets" on "public"."tickets";

drop policy "admins_manage_userlevel" on "public"."userlevel";

drop policy "userlevel_select" on "public"."userlevel";

alter table "public"."air_shipments" drop constraint "air_shipments_order_id_fkey";

alter table "public"."boxes" drop constraint "fk_container";

alter table "public"."maritime_shipments" drop constraint "maritime_shipments_order_id_fkey";

alter table "public"."notification_reads" drop constraint "notification_reads_notification_id_fkey";

alter table "public"."order_reviews" drop constraint "order_reviews_client_id_fkey";

alter table "public"."order_reviews" drop constraint "order_reviews_order_id_fkey";

alter table "public"."order_state_history" drop constraint "order_state_history_order_id_fkey";

alter table "public"."orders" drop constraint "fk_box";

alter table "public"."orders" drop constraint "orders_asignedEChina_fkey";

alter table "public"."orders" drop constraint "orders_asignedEVzla_fkey";

alter table "public"."orders" drop constraint "orders_client_id_fkey";

alter table "public"."payments" drop constraint "pagos_order_id_fkey";

alter table "public"."print_history" drop constraint "print_history_ticket_id_fkey";

alter table "public"."product_alternatives" drop constraint "product_alternatives_order_id_fkey";

alter table "public"."api_health_logs" alter column "id" set default nextval('public.api_health_logs_id_seq'::regclass);

alter table "public"."business_config" alter column "id" set default nextval('public.business_config_id_seq'::regclass);

alter table "public"."exchange_rates" alter column "id" set default nextval('public.exchange_rates_id_seq'::regclass);

alter table "public"."exchange_rates_cny" alter column "id" set default nextval('public.exchange_rates_cny_id_seq'::regclass);

alter table "public"."order_state_history" alter column "id" set default nextval('public.order_state_history_id_seq'::regclass);

alter table "public"."orders" alter column "deliveryType" set default 'office'::public.deliverytype;

alter table "public"."orders" alter column "deliveryType" set data type public.deliverytype using "deliveryType"::text::public.deliverytype;

alter table "public"."orders" alter column "order_origin" set data type public.pais_tipo using "order_origin"::text::public.pais_tipo;

alter table "public"."orders" alter column "shippingType" set default 'air'::public."shippingType";

alter table "public"."orders" alter column "shippingType" set data type public."shippingType" using "shippingType"::text::public."shippingType";

alter table "public"."print_history" alter column "id" set default nextval('public.print_history_id_seq'::regclass);

alter table "public"."product_alternatives" alter column "id" set default nextval('public.product_alternatives_id_seq'::regclass);

alter table "public"."tickets" alter column "id" set default nextval('public.tickets_id_seq'::regclass);

alter table "public"."air_shipments" add constraint "air_shipments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."air_shipments" validate constraint "air_shipments_order_id_fkey";

alter table "public"."boxes" add constraint "fk_container" FOREIGN KEY (container_id) REFERENCES public.containers(container_id) not valid;

alter table "public"."boxes" validate constraint "fk_container";

alter table "public"."maritime_shipments" add constraint "maritime_shipments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."maritime_shipments" validate constraint "maritime_shipments_order_id_fkey";

alter table "public"."notification_reads" add constraint "notification_reads_notification_id_fkey" FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE not valid;

alter table "public"."notification_reads" validate constraint "notification_reads_notification_id_fkey";

alter table "public"."order_reviews" add constraint "order_reviews_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(user_id) ON DELETE CASCADE not valid;

alter table "public"."order_reviews" validate constraint "order_reviews_client_id_fkey";

alter table "public"."order_reviews" add constraint "order_reviews_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_reviews" validate constraint "order_reviews_order_id_fkey";

alter table "public"."order_state_history" add constraint "order_state_history_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_state_history" validate constraint "order_state_history_order_id_fkey";

alter table "public"."orders" add constraint "fk_box" FOREIGN KEY (box_id) REFERENCES public.boxes(box_id) not valid;

alter table "public"."orders" validate constraint "fk_box";

alter table "public"."orders" add constraint "orders_asignedEChina_fkey" FOREIGN KEY ("asignedEChina") REFERENCES public.employees(user_id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."orders" validate constraint "orders_asignedEChina_fkey";

alter table "public"."orders" add constraint "orders_asignedEVzla_fkey" FOREIGN KEY ("asignedEVzla") REFERENCES public.employees(user_id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."orders" validate constraint "orders_asignedEVzla_fkey";

alter table "public"."orders" add constraint "orders_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(user_id) not valid;

alter table "public"."orders" validate constraint "orders_client_id_fkey";

alter table "public"."payments" add constraint "pagos_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "pagos_order_id_fkey";

alter table "public"."print_history" add constraint "print_history_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE not valid;

alter table "public"."print_history" validate constraint "print_history_ticket_id_fkey";

alter table "public"."product_alternatives" add constraint "product_alternatives_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."product_alternatives" validate constraint "product_alternatives_order_id_fkey";


  create policy "admins_delete_administrators_v3"
  on "public"."administrators"
  as permissive
  for delete
  to authenticated
using (public.is_admin());



  create policy "admins_insert_administrators_v3"
  on "public"."administrators"
  as permissive
  for insert
  to authenticated
with check (public.is_admin());



  create policy "admins_select_administrators_v3"
  on "public"."administrators"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "admins_update_administrators_v3"
  on "public"."administrators"
  as permissive
  for update
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "admins_select_api_health_logs"
  on "public"."api_health_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "employees_manage_boxes_optimized"
  on "public"."boxes"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text]))))));



  create policy "admins_manage_business_config"
  on "public"."business_config"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))))
with check ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "admins_delete_clients_v3"
  on "public"."clients"
  as permissive
  for delete
  to authenticated
using (public.is_admin());



  create policy "admins_insert_clients_v3"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check (public.is_admin());



  create policy "admins_update_clients_v3"
  on "public"."clients"
  as permissive
  for update
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "employees_manage_containers_optimized"
  on "public"."containers"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text]))))));



  create policy "admins_delete_employees_v3"
  on "public"."employees"
  as permissive
  for delete
  to authenticated
using (public.is_admin());



  create policy "admins_insert_employees_v3"
  on "public"."employees"
  as permissive
  for insert
  to authenticated
with check (public.is_admin());



  create policy "admins_update_employees_v3"
  on "public"."employees"
  as permissive
  for update
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "admins_delete_reviews"
  on "public"."order_reviews"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "clients_insert_reviews"
  on "public"."order_reviews"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = order_reviews.order_id))));



  create policy "users_select_reviews"
  on "public"."order_reviews"
  as permissive
  for select
  to authenticated
using (((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = order_reviews.order_id))) OR (EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text])))))));



  create policy "users_update_reviews"
  on "public"."order_reviews"
  as permissive
  for update
  to authenticated
using (((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = order_reviews.order_id))) OR (EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid))))))
with check (((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = order_reviews.order_id))) OR (EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "users_view_order_history"
  on "public"."order_state_history"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE (orders.id = order_state_history.order_id))));



  create policy "admins_full_access"
  on "public"."orders"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))))
with check ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = ( SELECT auth.uid() AS uid)))));



  create policy "china_employees_select_orders"
  on "public"."orders"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = 'China'::text)))) AND ((("asignedEChina" = ( SELECT auth.uid() AS uid)) AND ((state >= 1) AND (state <= 8))) OR (("asignedEChina" IS NULL) AND (state = ANY (ARRAY[1, 2, 3]))) OR ((state >= 4) AND (state <= 8)))));



  create policy "china_employees_update_orders"
  on "public"."orders"
  as permissive
  for update
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = 'China'::text)))) AND ((("asignedEChina" = ( SELECT auth.uid() AS uid)) AND ((state >= 1) AND (state <= 8))) OR (("asignedEChina" IS NULL) AND (state = ANY (ARRAY[1, 2, 3]))) OR ((state >= 1) AND (state <= 8)))))
with check (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = 'China'::text)))) AND (((state >= 1) AND (state <= 9)) OR (state = '-1'::integer))));



  create policy "clients_insert_orders"
  on "public"."orders"
  as permissive
  for insert
  to authenticated
with check (((EXISTS ( SELECT 1
   FROM public.clients
  WHERE (clients.user_id = ( SELECT auth.uid() AS uid)))) AND (client_id = ( SELECT auth.uid() AS uid))));



  create policy "pagos_select_orders"
  on "public"."orders"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = auth.uid()) AND (userlevel.user_level = 'Pagos'::text)))) AND (state = ANY (ARRAY[3, 4, 5, '-1'::integer]))));



  create policy "pagos_update_order_state"
  on "public"."orders"
  as permissive
  for update
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = auth.uid()) AND (userlevel.user_level = 'Pagos'::text)))) AND (state = ANY (ARRAY[3, 4, 5, '-1'::integer]))))
with check ((state = ANY (ARRAY[4, 5, '-1'::integer])));



  create policy "vzla_employees_select_orders"
  on "public"."orders"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = 'Vzla'::text)))) AND (("asignedEVzla" = ( SELECT auth.uid() AS uid)) OR (state >= 4))));



  create policy "vzla_employees_update_orders"
  on "public"."orders"
  as permissive
  for update
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = 'Vzla'::text)))) AND (("asignedEVzla" = ( SELECT auth.uid() AS uid)) OR (state >= 4))));



  create policy "Admins can insert print history"
  on "public"."print_history"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "Admins can view print history"
  on "public"."print_history"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "clients_update_alternatives"
  on "public"."product_alternatives"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = product_alternatives.order_id))))
with check ((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = product_alternatives.order_id))));



  create policy "employees_insert_alternatives"
  on "public"."product_alternatives"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text]))))));



  create policy "users_select_alternatives"
  on "public"."product_alternatives"
  as permissive
  for select
  to authenticated
using (((( SELECT auth.uid() AS uid) = ( SELECT orders.client_id
   FROM public.orders
  WHERE (orders.id = product_alternatives.order_id))) OR (EXISTS ( SELECT 1
   FROM public.userlevel
  WHERE ((userlevel.id = ( SELECT auth.uid() AS uid)) AND (userlevel.user_level = ANY (ARRAY['China'::text, 'Vzla'::text, 'Admin'::text])))))));



  create policy "Admins can delete tickets"
  on "public"."tickets"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "Admins can insert tickets"
  on "public"."tickets"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "Admins can update tickets"
  on "public"."tickets"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))))
with check ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "Admins can view all tickets"
  on "public"."tickets"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))));



  create policy "admins_manage_userlevel"
  on "public"."userlevel"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "userlevel_select"
  on "public"."userlevel"
  as permissive
  for select
  to authenticated
using (((( SELECT auth.uid() AS uid) = id) OR public.is_admin() OR (user_level = 'Admin'::text)));


CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.business_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_messages_updated_at();

CREATE TRIGGER chat_typing_updated_at BEFORE UPDATE ON public.chat_typing_status FOR EACH ROW EXECUTE FUNCTION public.update_chat_typing_updated_at();

CREATE TRIGGER order_reviews_updated_at BEFORE UPDATE ON public.order_reviews FOR EACH ROW EXECUTE FUNCTION public.update_order_reviews_updated_at();

CREATE TRIGGER assign_order_on_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_order_to_employee();

CREATE TRIGGER set_elapsed_time BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_elapsed_time();

CREATE TRIGGER tr_order_state_change AFTER INSERT OR UPDATE OF state ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_state_change();

CREATE TRIGGER trg_set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_update_max_state BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_max_state_reached();

CREATE TRIGGER trigger_update_product_alternatives_updated_at BEFORE UPDATE ON public.product_alternatives FOR EACH ROW EXECUTE FUNCTION public.update_product_alternatives_updated_at();

CREATE TRIGGER trigger_update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_tickets_updated_at();

CREATE TRIGGER manage_user_roles_trigger AFTER INSERT OR UPDATE ON public.userlevel FOR EACH ROW EXECUTE FUNCTION public.manage_user_roles();

CREATE TRIGGER trg_userlevel_set_updated_at BEFORE UPDATE ON public.userlevel FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_employee_user_level AFTER INSERT OR UPDATE ON public.userlevel FOR EACH ROW EXECUTE FUNCTION public.update_employee_user_level_function();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_userlevel();

drop policy "users_upload_own_order_files" on "storage"."objects";

drop policy "users_view_accessible_order_files" on "storage"."objects";

drop policy "users_view_chat_files" on "storage"."objects";


  create policy "users_upload_own_order_files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'orders'::text) AND ((storage.foldername(name))[1] IN ( SELECT (orders.id)::text AS id
   FROM public.orders
  WHERE (orders.client_id = auth.uid())))));



  create policy "users_view_accessible_order_files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'orders'::text) AND (((storage.foldername(name))[1] IN ( SELECT (orders.id)::text AS id
   FROM public.orders
  WHERE (orders.client_id = auth.uid()))) OR ((storage.foldername(name))[1] IN ( SELECT (orders.id)::text AS id
   FROM public.orders
  WHERE ((orders."asignedEChina" = auth.uid()) OR (orders."asignedEVzla" = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.administrators
  WHERE (administrators.user_id = auth.uid()))))));



  create policy "users_view_chat_files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'chat-files'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM public.chat_messages
  WHERE (((chat_messages.sender_id = auth.uid()) OR (chat_messages.receiver_id = auth.uid())) AND (chat_messages.file_url ~~ (('%'::text || objects.name) || '%'::text))))))));




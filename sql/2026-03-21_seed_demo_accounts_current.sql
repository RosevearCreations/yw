-- Demo seed for current schema. Change passwords after first login.
begin;

insert into public.staff_users (
  full_name,email,role_code,is_active,password_hash,
  can_override_lower_entries,can_manage_bookings,can_manage_blocks,can_manage_progress,can_manage_promos,can_manage_staff,
  preferred_contact_name,phone,sms_phone,address_line1,city,province,postal_code,
  employee_code,position_title,hire_date,emergency_contact_name,emergency_contact_phone,
  admin_level,pay_schedule,hourly_rate_cents,preferred_work_hours,admin_private_notes,notes
)
values (
  'Rosie Admin','admin@rosiedazzlers.local','admin',true,'plain:Admin123!',
  true,true,true,true,true,true,
  'Rosie','555-000-1000','555-000-1002','1 Rosie Admin Way','Tillsonburg','Ontario','N4G 0A1',
  'RD-ADMIN-001','Administrator',current_date,'Emergency Contact','555-000-1001',
  2,'biweekly',3500,'Mon-Fri 8:00-17:00','Seeded admin private note','Seeded admin account'
)
on conflict (email) do update set
  full_name=excluded.full_name, role_code=excluded.role_code, is_active=true, password_hash=excluded.password_hash,
  can_override_lower_entries=excluded.can_override_lower_entries, can_manage_bookings=excluded.can_manage_bookings,
  can_manage_blocks=excluded.can_manage_blocks, can_manage_progress=excluded.can_manage_progress,
  can_manage_promos=excluded.can_manage_promos, can_manage_staff=excluded.can_manage_staff,
  preferred_contact_name=excluded.preferred_contact_name, phone=excluded.phone, sms_phone=excluded.sms_phone,
  address_line1=excluded.address_line1, city=excluded.city, province=excluded.province, postal_code=excluded.postal_code,
  employee_code=excluded.employee_code, position_title=excluded.position_title, hire_date=excluded.hire_date,
  emergency_contact_name=excluded.emergency_contact_name, emergency_contact_phone=excluded.emergency_contact_phone,
  admin_level=excluded.admin_level, pay_schedule=excluded.pay_schedule, hourly_rate_cents=excluded.hourly_rate_cents,
  preferred_work_hours=excluded.preferred_work_hours, admin_private_notes=excluded.admin_private_notes, notes=excluded.notes,
  updated_at=now();

insert into public.staff_users (
  full_name,email,role_code,is_active,password_hash,
  can_override_lower_entries,can_manage_bookings,can_manage_blocks,can_manage_progress,can_manage_promos,can_manage_staff,
  preferred_contact_name,phone,sms_phone,address_line1,city,province,postal_code,
  employee_code,position_title,hire_date,emergency_contact_name,emergency_contact_phone,
  pay_schedule,hourly_rate_cents,preferred_work_hours,total_tips_cents,notes
)
values (
  'Sample Detailer','detailer@rosiedazzlers.local','detailer',true,'plain:Detailer123!',
  false,false,false,true,false,false,
  'Alex','555-000-2000','555-000-2002','2 Rosie Detailer Lane','Tillsonburg','Ontario','N4G 0A2',
  'RD-DET-001','Mobile Detailer',current_date,'Emergency Contact','555-000-2001',
  'weekly',2400,'Tue-Sat 9:00-18:00',0,'Seeded detailer account'
)
on conflict (email) do update set
  full_name=excluded.full_name, role_code=excluded.role_code, is_active=true, password_hash=excluded.password_hash,
  can_manage_progress=excluded.can_manage_progress, preferred_contact_name=excluded.preferred_contact_name,
  phone=excluded.phone, sms_phone=excluded.sms_phone, address_line1=excluded.address_line1, city=excluded.city,
  province=excluded.province, postal_code=excluded.postal_code, employee_code=excluded.employee_code,
  position_title=excluded.position_title, hire_date=excluded.hire_date, emergency_contact_name=excluded.emergency_contact_name,
  emergency_contact_phone=excluded.emergency_contact_phone, pay_schedule=excluded.pay_schedule,
  hourly_rate_cents=excluded.hourly_rate_cents, preferred_work_hours=excluded.preferred_work_hours,
  notes=excluded.notes, updated_at=now();

insert into public.customer_profiles (
  email,full_name,phone,tier_code,notes,address_line1,address_line2,city,province,postal_code,
  vehicle_notes,is_active,password_hash,notification_opt_in,notification_channel,detailer_chat_opt_in,
  preferred_contact_name,sms_phone,alternate_service_address,client_private_notes,notify_on_progress_post,notify_on_media_upload,notify_on_comment_reply
)
values (
  'client@rosiedazzlers.local','Sample Client','555-000-3000','regular','Seeded sample customer profile',
  '3 Customer Crescent','', 'Tillsonburg','Ontario','N4G 0A3',
  '2020 Honda CR-V, silver, customer wants frequent updates', true,'plain:Client123!', true,'email',true,
  'Jess','555-000-3001','200 Example Work Address, Tillsonburg, Ontario','Seeded client private note',true,true,true
)
on conflict (email) do update set
  full_name=excluded.full_name, phone=excluded.phone, tier_code=excluded.tier_code, notes=excluded.notes,
  address_line1=excluded.address_line1, address_line2=excluded.address_line2, city=excluded.city,
  province=excluded.province, postal_code=excluded.postal_code, vehicle_notes=excluded.vehicle_notes,
  is_active=true, password_hash=excluded.password_hash, notification_opt_in=excluded.notification_opt_in,
  notification_channel=excluded.notification_channel, detailer_chat_opt_in=excluded.detailer_chat_opt_in,
  preferred_contact_name=excluded.preferred_contact_name, sms_phone=excluded.sms_phone,
  alternate_service_address=excluded.alternate_service_address, client_private_notes=excluded.client_private_notes,
  notify_on_progress_post=excluded.notify_on_progress_post, notify_on_media_upload=excluded.notify_on_media_upload,
  notify_on_comment_reply=excluded.notify_on_comment_reply, updated_at=now();

with client as (
  select id from public.customer_profiles where lower(email)=lower('client@rosiedazzlers.local') limit 1
)
insert into public.customer_vehicles (
  customer_profile_id,is_primary,display_order,vehicle_name,model_year,make,model,color,mileage_km,last_wash_at,
  parking_location,alternate_service_address,notes_for_team,detailer_visible_notes,admin_private_notes,
  has_water_hookup,has_power_hookup,live_updates_opt_in,save_billing_on_file
)
select id,true,0,'Jess Cruiser',2020,'Honda','CR-V','Silver',85432,current_date-12,
       'Home driveway','200 Example Work Address, Tillsonburg, Ontario','Please avoid scented products.','Scratch noted on rear bumper.','Admin note: repeat client and flexible with timing.',
       true,true,true,false
from client
where not exists (select 1 from public.customer_vehicles cv where cv.customer_profile_id = client.id);

with det as (select id from public.staff_users where lower(email)=lower('detailer@rosiedazzlers.local') limit 1),
cli as (select id from public.customer_profiles where lower(email)=lower('client@rosiedazzlers.local') limit 1)
insert into public.bookings (
  status,job_status,service_date,start_slot,duration_slots,service_area,package_code,vehicle_size,
  customer_name,customer_email,customer_phone,address_line1,city,postal_code,currency,price_total_cents,deposit_cents,
  notes,assigned_to,assigned_staff_user_id,assigned_staff_email,assigned_staff_name,customer_profile_id,customer_tier_code,
  progress_enabled,progress_token
)
select 'confirmed','scheduled',current_date + 1,'AM',1,'Oxford','full_detail','mid',
       'Sample Client','client@rosiedazzlers.local','555-000-3000','3 Customer Crescent','Tillsonburg','N4G 0A3','CAD',24999,5000,
       'Seeded sample booking','Sample Detailer',det.id,'detailer@rosiedazzlers.local','Sample Detailer',cli.id,'regular',true,gen_random_uuid()
from det, cli
where not exists (
  select 1 from public.bookings b where lower(b.customer_email)=lower('client@rosiedazzlers.local') and b.service_date=current_date + 1
);

insert into public.gift_certificates (
  code,sku,type,status,remaining_cents,face_value_cents,currency,package_code,vehicle_size,purchaser_email,recipient_email,expires_at
)
select 'RD-SAMPLE-GIFT-001','GIFT-100','open_value','active',10000,10000,'CAD',null,null,'client@rosiedazzlers.local','client@rosiedazzlers.local',now() + interval '1 year'
where not exists (select 1 from public.gift_certificates where code='RD-SAMPLE-GIFT-001');

commit;

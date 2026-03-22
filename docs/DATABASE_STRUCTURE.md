# Database Structure

## Main tables
- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

## Expanded profiles direction

`profiles` now needs to support:
- `email`, `email_verified`
- `full_name`
- `role`, `is_active`
- `phone`, `phone_verified`
- `address_line1`, `address_line2`, `city`, `province`, `postal_code`
- `emergency_contact_name`, `emergency_contact_phone`
- `vehicle_make_model`, `vehicle_plate`
- `years_employed`
- `current_position`
- `previous_employee`
- `trade_specialty`
- `certifications`
- `feature_preferences`
- `notes`

## Role model
- `worker`
- `staff`
- `onsite_admin`
- `site_leader`
- `supervisor`
- `hse`
- `job_admin`
- `admin`

## Security helper SQL

Current helper direction is built around:
- `role_rank()`
- `profile_role_rank()`
- `site_assignment_role_rank()`
- `effective_site_role_rank()`
- `can_manage_site()`

See `sql/036_employee_profile_expansion.sql` and `sql/037_security_rls_verification_notes.sql` for the newest planning layer.

# Testing Checklist

## Authentication
- magic link login works
- password login works
- first-time password creation works
- reset password works
- log out everywhere works

## Route guards
- worker cannot stay on `#admin`
- supervisor can open directory but remains read-only unless backend explicitly allows more
- admin can open and manage admin records

## Workforce profile fields
- admin profile editor loads extended profile fields
- save payload includes contact/employment/vehicle/preferences fields

## Outbox
- failed submission stores locally
- retry button replays queued items through shared outbox module

## Docs
- markdown files match the current module structure

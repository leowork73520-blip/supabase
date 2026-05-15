# Simple Appointment Request System

A serverless appointment request website built with plain HTML, CSS, JavaScript, and Supabase.

## Features
- **Public Page:** Visitors can submit their name and mobile number to request a callback.
- **Admin Panel:** Secure admin login to view, update status, add notes, and delete appointment requests.
- **Serverless Backend:** Uses Supabase for database, authentication, and Row Level Security.

## Setup
1.  Create a Supabase project.
2.  Run the SQL setup script from the guide in your Supabase SQL Editor.
3.  Update `config.js` with your Supabase Project URL and anon key.
4.  Host the files on GitHub Pages.

## Security
- Row Level Security is enabled on all database tables.
- Public users can only insert their own name and mobile number.
- Admin access requires both Supabase Auth login and being listed in the `admins` table.

create extension if not exists postgis;

create type user_role as enum ('warga', 'bpbd_operator', 'bpbd_provinsi', 'peneliti', 'admin');
create type user_status as enum ('menunggu', 'aktif', 'nonaktif', 'ditolak');
create type risk_class as enum ('rendah', 'sedang', 'tinggi', 'sangat_tinggi');
create type report_severity as enum ('ringan', 'sedang', 'parah', 'sangat_parah');
create type report_status as enum ('menunggu', 'divalidasi', 'ditolak', 'duplikat', 'perlu_review');
create type audit_outcome as enum ('success', 'fail', 'denied', 'partial');

create table users (
  id uuid primary key,
  name varchar(150) not null,
  email varchar(150) unique not null,
  password_hash varchar(255),
  phone_number varchar(30),
  role user_role not null,
  institution varchar(150),
  region_id uuid,
  status user_status not null default 'menunggu',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table regions (
  id uuid primary key,
  province varchar(100) not null default 'Lampung',
  regency varchar(100) not null,
  district varchar(100),
  village varchar(100),
  geometry geometry(MultiPolygon, 4326) not null,
  population integer,
  coastal_flag boolean not null default false,
  distance_to_coast_m numeric(10, 2),
  avg_elevation_m numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add constraint users_region_id_foreign foreign key (region_id) references regions(id);

create table predictions (
  id uuid primary key,
  region_id uuid not null references regions(id),
  prediction_date date not null,
  risk_probability numeric(5, 2) not null,
  risk_class risk_class not null,
  confidence_score numeric(5, 2),
  max_tidal_height numeric(6, 2),
  peak_time time,
  model_version varchar(50) not null,
  generated_at timestamptz not null,
  unique (region_id, prediction_date)
);

create table ground_truth_reports (
  id uuid primary key,
  report_code varchar(30) unique not null,
  user_id uuid not null references users(id),
  region_id uuid not null references regions(id),
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  severity report_severity not null,
  water_height_cm integer,
  incident_time timestamptz not null,
  description text not null,
  status report_status not null default 'menunggu',
  validated_by uuid references users(id),
  validated_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table report_photos (
  id uuid primary key,
  report_id uuid not null references ground_truth_reports(id) on delete cascade,
  file_url text not null,
  file_name varchar(255) not null,
  file_size integer not null,
  mime_type varchar(100) not null,
  uploaded_at timestamptz not null default now()
);

create table tidal_data (
  id uuid primary key,
  station_name varchar(150) not null,
  station_code varchar(50) not null,
  recorded_at timestamptz not null,
  tidal_height numeric(6, 2) not null,
  unit varchar(20) not null default 'm',
  source varchar(80) not null default 'BMKG'
);

create table datasets (
  id uuid primary key,
  name varchar(180) not null,
  description text not null,
  dataset_type varchar(80) not null,
  period_start date not null,
  period_end date not null,
  resolution varchar(80) not null,
  record_count bigint not null default 0,
  license varchar(120) not null,
  csv_url text,
  json_url text,
  visibility varchar(40) not null default 'peneliti'
);

create table api_keys (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  key_hash varchar(255) not null,
  key_prefix varchar(24) not null,
  status varchar(30) not null default 'aktif',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table notification_settings (
  id uuid primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  channels jsonb not null default '[]',
  event_types jsonb not null default '[]',
  quiet_start time,
  quiet_end time,
  monitored_regions jsonb not null default '[]'
);

create table audit_logs (
  id uuid primary key,
  actor_user_id uuid references users(id),
  actor_name varchar(150) not null,
  actor_role varchar(50) not null,
  action varchar(100) not null,
  target_resource varchar(150),
  outcome audit_outcome not null,
  ip_address varchar(80),
  user_agent text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index reports_coordinates_idx on ground_truth_reports (latitude, longitude);
create index predictions_date_idx on predictions (prediction_date, risk_class);
create index audit_logs_action_idx on audit_logs (action, outcome, created_at);

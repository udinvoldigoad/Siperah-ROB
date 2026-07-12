create table users (
  id char(36) primary key,
  name varchar(150) not null,
  email varchar(150) unique not null,
  password_hash varchar(255),
  phone_number varchar(30),
  role enum('warga', 'bpbd_operator', 'bpbd_provinsi', 'peneliti', 'admin') not null,
  institution varchar(150),
  region_id char(36),
  status enum('menunggu', 'aktif', 'nonaktif', 'ditolak') not null default 'menunggu',
  last_login_at timestamp null default null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

create table regions (
  id char(36) primary key,
  province varchar(100) not null default 'Lampung',
  regency varchar(100) not null,
  district varchar(100),
  village varchar(100),
  geometry MULTIPOLYGON not null,
  population integer,
  coastal_flag tinyint(1) not null default 0,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

alter table users add constraint users_region_id_foreign foreign key (region_id) references regions(id);

create table predictions (
  id char(36) primary key,
  region_id char(36) not null references regions(id),
  prediction_date date not null,
  risk_probability decimal(5, 2) not null,
  risk_class enum('rendah', 'sedang', 'tinggi', 'sangat_tinggi') not null,
  confidence_score decimal(5, 2),
  max_tidal_height decimal(6, 2),
  peak_time time,
  model_version varchar(50) not null,
  generated_at timestamp not null,
  unique (region_id, prediction_date)
);

create table ground_truth_reports (
  id char(36) primary key,
  report_code varchar(30) unique not null,
  user_id char(36) not null references users(id),
  region_id char(36) not null references regions(id),
  latitude decimal(9, 6) not null,
  longitude decimal(9, 6) not null,
  severity enum('ringan', 'sedang', 'parah', 'sangat_parah') not null,
  water_height_cm integer,
  incident_time timestamp not null,
  description text not null,
  status enum('menunggu', 'divalidasi', 'ditolak', 'duplikat', 'perlu_review') not null default 'menunggu',
  validated_by char(36) references users(id),
  validated_at timestamp null default null,
  rejection_reason text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

create table report_photos (
  id char(36) primary key,
  report_id char(36) not null references ground_truth_reports(id) on delete cascade,
  file_url text not null,
  file_name varchar(255) not null,
  file_size integer not null,
  mime_type varchar(100) not null,
  uploaded_at timestamp not null default current_timestamp
);

create table tidal_data (
  id char(36) primary key,
  station_name varchar(150) not null,
  station_code varchar(50) not null,
  recorded_at timestamp not null,
  tidal_height decimal(6, 2) not null,
  unit varchar(20) not null default 'm',
  source varchar(80) not null default 'BMKG'
);

create table datasets (
  id char(36) primary key,
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
  id char(36) primary key,
  user_id char(36) not null references users(id),
  key_hash varchar(255) not null,
  key_prefix varchar(24) not null,
  status varchar(30) not null default 'aktif',
  last_used_at timestamp null default null,
  created_at timestamp not null default current_timestamp,
  revoked_at timestamp null default null
);

create table notification_settings (
  id char(36) primary key,
  user_id char(36) not null unique references users(id),
  channels json not null,
  event_types json not null,
  quiet_start time,
  quiet_end time,
  monitored_regions json not null
);

create table audit_logs (
  id char(36) primary key,
  actor_user_id char(36) references users(id),
  actor_name varchar(150) not null,
  actor_role varchar(50) not null,
  action varchar(100) not null,
  target_resource varchar(150),
  outcome enum('success', 'fail', 'denied', 'partial') not null,
  ip_address varchar(80),
  user_agent text,
  payload json,
  created_at timestamp not null default current_timestamp
);

create index reports_coordinates_idx on ground_truth_reports (latitude, longitude);
create index predictions_date_idx on predictions (prediction_date, risk_class);
create index audit_logs_action_idx on audit_logs (action, outcome, created_at);

-- Таблица локаций (Locations)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    base_hours NUMERIC DEFAULT 8,
    work_start_time TEXT DEFAULT '11:00',
    work_end_time TEXT DEFAULT '00:00',
    late_fine_amount NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица профилей сотрудников (Profiles)
-- Связана с auth.users (сотрудники с должностью 'Кассир' имеют начало смены в 10:45)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    shift_rate NUMERIC DEFAULT 0,
    role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    iiko_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица отметок времени (Time Records)
CREATE TABLE IF NOT EXISTS public.time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    record_type TEXT CHECK (record_type IN ('check_in', 'check_out')) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Таблица решений по штрафам за опоздания (Late Fine Approvals)
CREATE TABLE IF NOT EXISTS public.late_fine_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    calculated_fine NUMERIC NOT NULL,
    approved_fine NUMERIC NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, record_date)
);

-- Таблица авансов (Advances)
CREATE TABLE IF NOT EXISTS public.advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reason TEXT DEFAULT 'На личные нужды',
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'paid')) DEFAULT 'pending',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    approved_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица удержаний (Deductions: инвентаризация, списания, недостачи)
CREATE TABLE IF NOT EXISTS public.deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    category TEXT DEFAULT 'Инвентаризация',
    comment TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица шаблонов чек-листов (Checklist Templates)
CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    shift_type TEXT CHECK (shift_type IN ('opening', 'closing', 'day', 'any')) DEFAULT 'any',
    target_role TEXT DEFAULT 'all',
    location_id UUID REFERENCES public.locations(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица пунктов чек-листа (Checklist Template Items)
CREATE TABLE IF NOT EXISTS public.checklist_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    item_type TEXT CHECK (item_type IN ('boolean', 'text', 'number', 'photo')) DEFAULT 'boolean',
    is_required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0
);

-- Таблица заполнений чек-листов (Checklist Submissions)
CREATE TABLE IF NOT EXISTS public.checklist_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id),
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица ответов по пунктам чек-листа (Checklist Submission Entries)
CREATE TABLE IF NOT EXISTS public.checklist_submission_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.checklist_submissions(id) ON DELETE CASCADE,
    template_item_id UUID REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
    bool_value BOOLEAN,
    text_value TEXT,
    number_value NUMERIC,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

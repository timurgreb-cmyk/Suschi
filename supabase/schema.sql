-- Таблица локаций (Locations)
CREATE TABLE public.locations (
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
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    shift_rate NUMERIC DEFAULT 0,
    role TEXT CHECK (role IN ('employee', 'admin')) DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица отметок времени (Time Records)
CREATE TABLE public.time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    record_type TEXT CHECK (record_type IN ('check_in', 'check_out')) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Таблица смен/графика (Shifts)
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    planned_start TIME,
    planned_end TIME
);

-- Настройка Row Level Security (RLS)

-- 1. Locations: чтение для всех авторизованных, запись только для admin
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations are viewable by everyone" ON public.locations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Locations are insertable by admin" ON public.locations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Locations are updatable by admin" ON public.locations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 2. Profiles: чтение своего профиля, или всех если admin
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin can update all profiles" ON public.profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Time Records: чтение/запись своих записей, или всех если admin
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time records" ON public.time_records
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Users can insert their own time records" ON public.time_records
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admin can view all time records" ON public.time_records
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin can update/delete all time records" ON public.time_records
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shifts" ON public.shifts
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Admin can manage all shifts" ON public.shifts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Функция для автоматического создания профиля (опционально, если admin создает юзера через auth API)
-- Мы не используем триггер, так как Admin будет использовать service_role для создания профиля.


-- Таблица решений по штрафам за опоздания (Late Fine Approvals)
CREATE TABLE public.late_fine_approvals (
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

ALTER TABLE public.late_fine_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own late fine approvals" ON public.late_fine_approvals
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Admin can manage all late fine approvals" ON public.late_fine_approvals
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'membro');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'membro',
  UNIQUE(user_id, role)
);

-- Create membros_funcoes table (functions a member can perform)
CREATE TABLE public.membros_funcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  funcao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create escalas table (schedules)
CREATE TABLE public.escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create escala_membros table (members in a schedule)
CREATE TABLE public.escala_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  funcao_na_escala TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create musicas table
CREATE TABLE public.musicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  artista TEXT,
  tom TEXT,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create escala_musicas table (songs in a schedule)
CREATE TABLE public.escala_musicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
  musica_id UUID NOT NULL REFERENCES public.musicas(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.musicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_musicas ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is member of a schedule
CREATE OR REPLACE FUNCTION public.is_member_of_escala(_user_id UUID, _escala_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.escala_membros em
    JOIN public.profiles p ON em.profile_id = p.id
    WHERE p.id = _user_id
      AND em.escala_id = _escala_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Membros funcoes policies
CREATE POLICY "Authenticated users can view functions" ON public.membros_funcoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage member functions" ON public.membros_funcoes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Escalas policies
CREATE POLICY "Admins can do everything with escalas" ON public.escalas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view escalas they are part of" ON public.escalas
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.is_member_of_escala(auth.uid(), id)
  );

-- Escala membros policies
CREATE POLICY "Admins can manage escala members" ON public.escala_membros
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view escala members for their escalas" ON public.escala_membros
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.is_member_of_escala(auth.uid(), escala_id)
  );

-- Musicas policies
CREATE POLICY "Authenticated users can view musicas" ON public.musicas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage musicas" ON public.musicas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Escala musicas policies
CREATE POLICY "Admins can manage escala musicas" ON public.escala_musicas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view escala musicas for their escalas" ON public.escala_musicas
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.is_member_of_escala(auth.uid(), escala_id)
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'membro');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
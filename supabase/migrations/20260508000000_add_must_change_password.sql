ALTER TABLE public.profiles
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'membro');

  RETURN NEW;
END;
$$;

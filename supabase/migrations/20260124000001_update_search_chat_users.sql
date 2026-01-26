
-- Update search_chat_users to include 'Pagos' role
CREATE OR REPLACE FUNCTION search_chat_users(
  search_query TEXT,
  current_user_id UUID,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'name', au.email)::TEXT as user_name,
    COALESCE(ul.user_level, 'unknown')::TEXT as user_role,
    (au.raw_user_meta_data->>'avatar_url')::TEXT as avatar
  FROM auth.users au
  LEFT JOIN userlevel ul ON ul.id = au.id
  WHERE au.id != current_user_id
    AND ul.user_level IN ('Admin', 'China', 'Vzla', 'Venezuela', 'Pagos', 'pagos') -- Added Pagos/pagos
    AND (
      search_query = '' 
      OR search_query IS NULL
      OR au.email ILIKE '%' || search_query || '%'
      OR (au.raw_user_meta_data->>'name') ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN search_query != '' AND au.email ILIKE search_query || '%' THEN 0 ELSE 1 END,
    au.email
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

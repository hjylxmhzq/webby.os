pub fn hash_pwd(s: &str) -> String {
  sha256::digest(s.to_string())
}
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use std::fs;

// Chave mestra de 32 bytes (256 bits)
// NOTA: Em app bancário isso seria inseguro, mas para proteger JSON de bíblia de curiosos, é suficiente.
const MASTER_KEY: &[u8; 32] = b"ProjChurch_Bible_Secure_Key_2025"; 

pub fn encrypt_data(data: &str) -> Result<Vec<u8>, String> {
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(MASTER_KEY);
    let cipher = Aes256Gcm::new(key);
    
    // Gera Nonce aleatório de 96 bits (12 bytes)
    let mut nonce_bytes = [0u8; 12];
    aes_gcm::aead::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Erro de criptografia: {}", e))?;
    
    // Formato do arquivo: [NONCE 12 bytes] + [CIPHERTEXT]
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}

pub fn decrypt_data(data: &[u8]) -> Result<String, String> {
    if data.len() < 12 {
        return Err("Arquivo muito curto/inválido".to_string());
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(MASTER_KEY);
    let cipher = Aes256Gcm::new(key);
    
    let nonce = Nonce::from_slice(&data[0..12]);
    let ciphertext = &data[12..];
    
    let plaintext = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Erro de descriptografia: {}", e))?;
        
    String::from_utf8(plaintext).map_err(|e| format!("Erro UTF-8: {}", e))
}

pub fn write_file_secure(path: String, content: String) -> Result<(), String> {
    let encrypted = encrypt_data(&content)?;
    fs::write(path, encrypted).map_err(|e| e.to_string())
}

pub fn read_file_secure(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    
    // Tenta descriptografar
    match decrypt_data(&data) {
        Ok(content) => Ok(content),
        Err(_) => {
            // FALLBACK: Se falhar (ex: arquivo antigo não criptografado), tenta ler como string normal
            // Isso garante que quem já tem bíblias baixadas não perde nada.
            String::from_utf8(data).map_err(|_| "Falha ao ler arquivo protegido ou legado.".to_string())
        }
    }
}

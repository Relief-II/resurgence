#![no_std]
#[macro_use]
extern crate alloc;

use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, Vec};

/// Convert a `soroban_sdk::String` into a heap `alloc::string::String`.
///
/// `String::to_string()` relies on `Display`, which is only available off-chain
/// (std/test builds). This helper reads the raw UTF-8 bytes via the host and so
/// works in the `wasm32` contract build as well.
pub(crate) fn sstr_to_alloc(s: &soroban_sdk::String) -> alloc::string::String {
    let len = s.len() as usize;
    let mut buf = alloc::vec![0u8; len];
    s.copy_into_slice(&mut buf);
    alloc::string::String::from_utf8(buf).unwrap_or_default()
}

pub mod rbac;

mod aid_registry;
mod beneficiary_manager;
mod merchant_network;
mod cash_transfer;
mod supply_chain_tracker;
mod anti_fraud;

#[cfg(test)]
mod test;

pub use aid_registry::*;
pub use beneficiary_manager::*;
pub use merchant_network::*;
pub use cash_transfer::*;
pub use supply_chain_tracker::*;
pub use anti_fraud::*;

#[contract]
pub struct DisasterReliefPlatform;

#[contractimpl]
impl DisasterReliefPlatform {
    /// Initialize the disaster relief platform with admin addresses
    pub fn initialize(env: Env, admin: Address, ngo_signer: Address, gov_signer: Address, un_signer: Address) {
        // Store multi-sig signers for emergency fund release
        env.storage().instance().set(&Symbol::new(&env, "admin"), &admin);
        env.storage().instance().set(&Symbol::new(&env, "ngo_sig"), &ngo_signer);
        env.storage().instance().set(&Symbol::new(&env, "gov_sig"), &gov_signer);
        env.storage().instance().set(&Symbol::new(&env, "un_sig"), &un_signer);
        
        // Initialize contract state
        env.storage().instance().set(&Symbol::new(&env, "initialized"), &true);
    }

    /// Get platform configuration
    pub fn get_config(env: Env) -> Vec<Address> {
        let mut config = Vec::new(&env);
        
        if let Some(admin) = env.storage().instance().get(&Symbol::new(&env, "admin")) {
            config.push_back(admin);
        }
        if let Some(ngo) = env.storage().instance().get(&Symbol::new(&env, "ngo_sig")) {
            config.push_back(ngo);
        }
        if let Some(gov) = env.storage().instance().get(&Symbol::new(&env, "gov_sig")) {
            config.push_back(gov);
        }
        if let Some(un) = env.storage().instance().get(&Symbol::new(&env, "un_sig")) {
            config.push_back(un);
        }
        
        config
    }

    /// Check if platform is initialized
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance()
            .get(&Symbol::new(&env, "initialized"))
            .unwrap_or(false)
    }
}

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, String, Vec, Map, U256};

use crate::rbac::{self, ROLE_NGO, ROLE_TRANSPORTER, ROLE_RECIPIENT};

#[contract]
pub struct SupplyChainTracker;

#[contracttype]
#[derive(Clone)]
pub struct SupplyShipment {
    pub id: String,
    pub donor_id: String,
    pub supply_type: String,
    pub quantity: U256,
    pub unit: String,
    pub origin: Location,
    pub destination: Location,
    pub created_at: u64,
    pub estimated_arrival: u64,
    pub current_status: String,
    pub checkpoints: Vec<Checkpoint>,
    pub assigned_transporter: Option<Address>,
    // Cold-chain requirements flattened (nested Option<struct> isn't supported
    // by the contract type system's ScVal conversion).
    pub requires_temp_control: bool,
    pub min_temp: i64,
    pub max_temp: i64,
    pub temp_critical: bool,
    pub special_handling: Vec<String>,
    /// The address that created this shipment (used for ownership checks).
    pub creator: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Location {
    /// Latitude scaled by 1e6 (e.g. 40.123456 -> 40123456).
    pub latitude: i64,
    /// Longitude scaled by 1e6.
    pub longitude: i64,
    pub address: String,
    pub facility_name: String,
    pub contact_person: String,
}

#[contracttype]
#[derive(Clone)]
pub struct Checkpoint {
    pub id: String,
    pub location: Location,
    pub timestamp: u64,
    pub verified_by: Address,
    pub quantity_verified: U256,
    pub condition: String,
    pub photos: Vec<String>,
    pub notes: String,
    /// Temperature in tenths of a degree Celsius (e.g. 25.5°C -> 255).
    pub temperature: Option<i64>,
}

#[contracttype]
#[derive(Clone)]
pub struct TemperatureRequirements {
    /// Minimum temperature in tenths of a degree Celsius.
    pub min_temp: i64,
    /// Maximum temperature in tenths of a degree Celsius.
    pub max_temp: i64,
    pub critical: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct RecipientConfirmation {
    pub shipment_id: String,
    pub recipient_id: String,
    pub received_quantity: U256,
    pub received_at: u64,
    pub condition_report: String,
    pub confirmed_by: Address,
    pub photos: Vec<String>,
}

#[contractimpl]
impl SupplyChainTracker {
    /// Create a new supply shipment.
    ///
    /// **Required role:** NGO
    pub fn create_shipment(
        env: Env,
        donor: Address,
        shipment_id: String,
        donor_id: String,
        supply_type: String,
        quantity: U256,
        unit: String,
        origin: Location,
        destination: Location,
        estimated_arrival: u64,
    ) {
        donor.require_auth();
        rbac::require_role(&env, &donor, ROLE_NGO);

        // Cold-chain requirements and special handling can be set later via
        // dedicated setters; default to none on creation.
        let special_handling: Vec<String> = Vec::new(&env);

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        if shipments.contains_key(shipment_id.clone()) {
            panic!("Shipment already exists");
        }

        let shipment = SupplyShipment {
            id: shipment_id.clone(),
            donor_id,
            supply_type,
            quantity,
            unit,
            origin,
            destination,
            created_at: env.ledger().timestamp(),
            estimated_arrival,
            current_status: String::from_str(&env, "in_transit"),
            checkpoints: Vec::new(&env),
            assigned_transporter: None,
            requires_temp_control: false,
            min_temp: 0,
            max_temp: 0,
            temp_critical: false,
            special_handling,
            creator: donor,
        };

        shipments.set(shipment_id, shipment);
        env.storage().instance().set(&shipments_key, &shipments);
    }

    /// Set cold-chain temperature requirements for a shipment.
    ///
    /// Temperatures are expressed in tenths of a degree Celsius
    /// (e.g. 8.0°C -> 80). Only the shipment creator (NGO) may set these.
    pub fn set_temperature_requirements(
        env: Env,
        caller: Address,
        shipment_id: String,
        min_temp: i64,
        max_temp: i64,
        critical: bool,
    ) {
        caller.require_auth();
        rbac::require_role(&env, &caller, ROLE_NGO);

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        let mut shipment = match shipments.get(shipment_id.clone()) {
            Some(s) => s,
            None => panic!("Shipment not found"),
        };

        if shipment.creator != caller {
            panic!("Unauthorized: caller is not the shipment creator");
        }

        shipment.requires_temp_control = true;
        shipment.min_temp = min_temp;
        shipment.max_temp = max_temp;
        shipment.temp_critical = critical;

        shipments.set(shipment_id, shipment);
        env.storage().instance().set(&shipments_key, &shipments);
    }

    /// Add a checkpoint to a shipment's journey.
    ///
    /// **Required role:** NGO
    pub fn add_checkpoint(
        env: Env,
        verifier: Address,
        shipment_id: String,
        location: Location,
        quantity_verified: U256,
        condition: String,
        photos: Vec<String>,
        notes: String,
        temperature: Option<i64>,
    ) {
        verifier.require_auth();
        rbac::require_role(&env, &verifier, ROLE_NGO);

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        let mut shipment = match shipments.get(shipment_id.clone()) {
            Some(s) => s,
            None => panic!("Shipment not found"),
        };

        if shipment.requires_temp_control {
            if let Some(current_temp) = temperature {
                if shipment.temp_critical
                    && (current_temp < shipment.min_temp || current_temp > shipment.max_temp)
                {
                    panic!("Temperature outside required range");
                }
            }
        }

        let checkpoint_id = String::from_str(&env, &format!("cp_{}", env.ledger().timestamp()));
        let checkpoint = Checkpoint {
            id: checkpoint_id,
            location,
            timestamp: env.ledger().timestamp(),
            verified_by: verifier,
            quantity_verified,
            condition,
            photos,
            notes,
            temperature,
        };

        shipment.checkpoints.push_back(checkpoint);
        if shipment.checkpoints.len() > 2 {
            shipment.current_status = String::from_str(&env, "at_checkpoint");
        }

        shipments.set(shipment_id, shipment);
        env.storage().instance().set(&shipments_key, &shipments);
    }

    /// Assign a transporter to a shipment.
    ///
    /// Only the shipment creator (NGO) may assign a transporter.
    pub fn assign_transporter(
        env: Env,
        donor: Address,
        shipment_id: String,
        transporter: Address,
    ) {
        donor.require_auth();
        rbac::require_role(&env, &donor, ROLE_NGO);

        // Ensure the assigned transporter is a registered transporter.
        if !rbac::has_role(&env, &transporter, ROLE_TRANSPORTER) {
            panic!("Unauthorized: transporter does not hold ROLE_TRANSPORTER");
        }

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        if let Some(mut shipment) = shipments.get(shipment_id.clone()) {
            // Only the original creator may reassign the transporter.
            if shipment.creator != donor {
                panic!("Unauthorized: caller is not the shipment creator");
            }
            shipment.assigned_transporter = Some(transporter);
            shipments.set(shipment_id, shipment);
            env.storage().instance().set(&shipments_key, &shipments);
        }
    }

    /// Confirm final delivery.
    ///
    /// Any authenticated address may confirm delivery (the recipient signs).
    pub fn confirm_delivery(
        env: Env,
        recipient: Address,
        shipment_id: String,
        recipient_id: String,
        received_quantity: U256,
        condition_report: String,
        photos: Vec<String>,
    ) {
        recipient.require_auth();

        // Require recipient to hold the recipient role for confirmation.
        rbac::require_role(&env, &recipient, ROLE_RECIPIENT);

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        let mut shipment = match shipments.get(shipment_id.clone()) {
            Some(s) => s,
            None => panic!("Shipment not found"),
        };

        let confirmation = RecipientConfirmation {
            shipment_id: shipment_id.clone(),
            recipient_id,
            received_quantity,
            received_at: env.ledger().timestamp(),
            condition_report,
            confirmed_by: recipient,
            photos,
        };

        let confirmations_key = Symbol::new(&env, "confirmations");
        let mut confirmations: Map<String, RecipientConfirmation> = env
            .storage()
            .instance()
            .get(&confirmations_key)
            .unwrap_or(Map::new(&env));
        confirmations.set(shipment_id.clone(), confirmation);
        env.storage().instance().set(&confirmations_key, &confirmations);

        shipment.current_status = String::from_str(&env, "delivered");
        shipments.set(shipment_id, shipment);
        env.storage().instance().set(&shipments_key, &shipments);
    }

    /// Report a shipment as lost.
    ///
    /// Any authenticated address may report a loss (the reporter signs).
    pub fn report_lost(env: Env, reporter: Address, shipment_id: String, reason: String) {
        reporter.require_auth();

        let shipments_key = Symbol::new(&env, "shipments");
        let mut shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));

        if let Some(mut shipment) = shipments.get(shipment_id.clone()) {
            shipment.current_status = String::from_str(&env, "lost");
            let loss_checkpoint = Checkpoint {
                id: String::from_str(&env, &format!("loss_{}", env.ledger().timestamp())),
                location: shipment.destination.clone(),
                timestamp: env.ledger().timestamp(),
                verified_by: reporter,
                quantity_verified: U256::from_u32(&env, 0),
                condition: String::from_str(&env, "lost"),
                photos: Vec::new(&env),
                notes: reason,
                temperature: None,
            };
            shipment.checkpoints.push_back(loss_checkpoint);
            shipments.set(shipment_id, shipment);
            env.storage().instance().set(&shipments_key, &shipments);
        }
    }

    // ── Read-only helpers ────────────────────────────────────────────────────

    pub fn get_shipment(env: Env, shipment_id: String) -> Option<SupplyShipment> {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        shipments.get(shipment_id)
    }

    pub fn get_shipment_history(
        env: Env,
        shipment_id: String,
    ) -> (Option<SupplyShipment>, Option<RecipientConfirmation>) {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        let confirmations_key = Symbol::new(&env, "confirmations");
        let confirmations: Map<String, RecipientConfirmation> = env
            .storage()
            .instance()
            .get(&confirmations_key)
            .unwrap_or(Map::new(&env));
        (
            shipments.get(shipment_id.clone()),
            confirmations.get(shipment_id),
        )
    }

    pub fn get_active_shipments(env: Env) -> Vec<SupplyShipment> {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        let mut active = Vec::new(&env);
        for (_, shipment) in shipments.iter() {
            if shipment.current_status != String::from_str(&env, "delivered")
                && shipment.current_status != String::from_str(&env, "lost")
            {
                active.push_back(shipment);
            }
        }
        active
    }

    pub fn get_shipments_by_donor(env: Env, donor_id: String) -> Vec<SupplyShipment> {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        let mut result = Vec::new(&env);
        for (_, shipment) in shipments.iter() {
            if shipment.donor_id == donor_id {
                result.push_back(shipment);
            }
        }
        result
    }

    /// Track shipments whose latest checkpoint falls within `radius` of the
    /// given point. Coordinates and radius are integers scaled by 1e6; the
    /// match uses squared Euclidean distance in that scaled space (sufficient
    /// for proximity filtering without floating-point math on-chain).
    pub fn track_by_location(
        env: Env,
        latitude: i64,
        longitude: i64,
        radius: i64,
    ) -> Vec<SupplyShipment> {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        let mut nearby = Vec::new(&env);
        let radius_sq = (radius as i128) * (radius as i128);
        for (_, shipment) in shipments.iter() {
            let cp_len = shipment.checkpoints.len();
            if let Some(latest) = if cp_len > 0 { shipment.checkpoints.get(cp_len - 1) } else { None } {
                let dlat = (latitude - latest.location.latitude) as i128;
                let dlon = (longitude - latest.location.longitude) as i128;
                let dist_sq = dlat * dlat + dlon * dlon;
                if dist_sq <= radius_sq {
                    nearby.push_back(shipment);
                }
            }
        }
        nearby
    }

    pub fn get_temperature_alerts(env: Env) -> Vec<(String, String)> {
        let shipments_key = Symbol::new(&env, "shipments");
        let shipments: Map<String, SupplyShipment> = env
            .storage()
            .instance()
            .get(&shipments_key)
            .unwrap_or(Map::new(&env));
        let mut alerts = Vec::new(&env);
        for (shipment_id, shipment) in shipments.iter() {
            if shipment.requires_temp_control {
                let cp_len = shipment.checkpoints.len();
                if let Some(latest) =
                    if cp_len > 0 { shipment.checkpoints.get(cp_len - 1) } else { None }
                {
                    if let Some(current_temp) = latest.temperature {
                        if current_temp < shipment.min_temp || current_temp > shipment.max_temp {
                            let alert_msg = format!(
                                "Temperature breach: {}°C (required: {}-{}°C)",
                                current_temp, shipment.min_temp, shipment.max_temp
                            );
                            alerts.push_back((
                                shipment_id.clone(),
                                String::from_str(&env, &alert_msg),
                            ));
                        }
                    }
                }
            }
        }
        alerts
    }
}

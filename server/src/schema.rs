// @generated automatically by Diesel CLI.

diesel::table! {
    file_index (file_path, updated_at) {
        file_name -> Text,
        file_path -> Text,
        username -> Text,
        size -> BigInt,
        created_at -> Text,
        modified_at -> Text,
        format -> Nullable<Text>,
        is_dir -> Bool,
        updated_at -> Text,
    }
}

diesel::table! {
    groups (name) {
        name -> Text,
        desc -> Text,
        permissions -> Text,
    }
}

diesel::table! {
    kv_storage (username, collection, key) {
        username -> Text,
        collection -> Text,
        key -> Text,
        value -> Text,
        is_private -> Bool,
    }
}

diesel::table! {
    users (username) {
        username -> Text,
        password -> Text,
        email -> Text,
        user_type -> Integer,
        user_root -> Text,
        group_name -> Text,
        otp_secret -> Nullable<Text>,
        web_authn_id -> Nullable<Text>,
    }
}

diesel::joinable!(users -> groups (group_name));

diesel::allow_tables_to_appear_in_same_query!(
    file_index,
    groups,
    kv_storage,
    users,
);

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
    users (username) {
        username -> Text,
        password -> Text,
        email -> Text,
        user_type -> Integer,
        user_root -> Text,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    file_index,
    users,
);

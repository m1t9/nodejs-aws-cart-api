INSERT INTO carts (id, user_id, created_at, updated_at, status) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '870f8945-8da3-4ac7-90b1-273712e64048',
    NOW(),
    NOW(),
    'OPEN'
);

INSERT INTO cart_items (cart_id, product_id, count, price) VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '7567ec4b-b10c-48c5-9345-fc73c48a80aa',
    1,
    15
);

INSERT INTO users (id, name, password) VALUES
  (uuid_generate_v4(), 'm1t9', 'TEST_PASSWORD')
ON CONFLICT (name) DO NOTHING;
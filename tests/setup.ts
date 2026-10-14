/**
 * Configuration commune des tests. Les tests d'intégration utilisent une
 * base PostgreSQL DÉDIÉE (jamais la base de production) : TEST_DATABASE_URL.
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://hotel:hotel_dev@localhost:5432/hotel_test";
process.env.APP_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.APP_MODE = "demo";
process.env.SITE_URL = "http://localhost:3000";
process.env.PAYMENT_PROVIDER = "demo";
process.env.DEMO_PAYMENT_WEBHOOK_SECRET = "demo-webhook-secret-for-tests";
process.env.EMAIL_PROVIDER = "none";

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Check if the database URL points to a cloud database or localhost
const isLocalhost = process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1");

// Create a single shared PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

// Create the driver adapter for Prisma 7
const adapter = new PrismaPg(pool);

// Instantiate the single global PrismaClient
export const prisma = new PrismaClient({
  adapter,
});

export default prisma;

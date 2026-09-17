// Seed data shared by prisma/seed.ts and the test suite.
export const WAREHOUSES = [
  { name: "Los Angeles", latitude: 33.9425, longitude: -118.408056, stock: 355 },
  { name: "New York", latitude: 40.639722, longitude: -73.778889, stock: 578 },
  { name: "São Paulo", latitude: -23.435556, longitude: -46.473056, stock: 265 },
  { name: "Paris", latitude: 49.009722, longitude: 2.547778, stock: 694 },
  { name: "Warsaw", latitude: 52.165833, longitude: 20.967222, stock: 245 },
  { name: "Hong Kong", latitude: 22.308889, longitude: 113.914444, stock: 419 },
] as const;

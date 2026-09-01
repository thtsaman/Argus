export const APP_CONFIG = {
  name: "ARGUS",
  version: "SYSTEM V2.0",
  tagline: "OMNISCIENT EVIDENCE INTELLIGENCE PLATFORM",
  description:
    "An evidence-first investigation intelligence platform for exploring relationships, geographic patterns, and temporal connections.",
  logo: "/images/logo.svg",
} as const;

export const WEST_BENGAL_LOCATIONS = [
  { name: "Kolkata", lat: 22.5726, lng: 88.3639, region: "Kolkata Metropolitan" },
  { name: "Howrah", lat: 22.5958, lng: 88.2636, region: "Howrah District" },
  { name: "North 24 Parganas", lat: 22.6167, lng: 88.4, region: "North 24 Parganas" },
  { name: "Malda", lat: 25.0104, lng: 88.1411, region: "Malda District" },
  { name: "Siliguri", lat: 26.7271, lng: 88.3953, region: "Darjeeling District" },
  { name: "Durgapur", lat: 23.5204, lng: 87.3119, region: "Paschim Bardhaman" },
  { name: "Asansol", lat: 23.6739, lng: 86.9524, region: "Paschim Bardhaman" },
] as const;

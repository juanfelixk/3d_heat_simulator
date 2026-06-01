export interface ContainerMaterial {
    label: string;
    thermalConductivity: number; // W/m K
    density: number; // kg/m^3
    specificHeat: number; // J/(kg K)
    color: string;
}

export interface LiquidMaterial {
    label: string;
    thermalDiffusivity: number; // mm^2/s
    density: number; // kg/m^3
    specificHeat: number; // J/(kg K)
    boilingPoint: number;
    color: string;
}

export interface AirCondition {
    label: string;
    h: number; // W/m^2 K
}

export const CONTAINER_MATERIALS: Record<string, ContainerMaterial> = {
    stainless_steel: {
        label: "Stainless Steel",
        thermalConductivity: 16,
        density: 8000,
        specificHeat: 500,
        color: "#b0bec5"
    },
    steel: {
        label: "Steel",
        thermalConductivity: 50,
        density: 7850,
        specificHeat: 490,
        color:"#8a9bb0"
    },
    copper: {
        label: "Copper",
        thermalConductivity: 385,
        density: 8960,
        specificHeat: 385,
        color: "#7a9ea8"
    },
    aluminum: {
        label: "Aluminium",
        thermalConductivity: 205,
        density: 2700,
        specificHeat: 900,
        color: "#90a4ae"
    },
    cast_iron: {
        label: "Cast Iron",
        thermalConductivity: 52,
        density: 7200,
        specificHeat: 460,
        color:"#546e7a"
    },
    glass: {
        label: "Borosilicate Glass",
        thermalConductivity: 1.2,
        density: 2230,
        specificHeat: 830,
        color: "#cfd8dc"
    },
};

export const LIQUID_MATERIALS: Record<string, LiquidMaterial> = {
    water: {
        label: "Water",
        thermalDiffusivity: 0.143,
        density: 998,
        specificHeat: 4182,
        boilingPoint: 100,
        color: "#4fc3f7",
    },
    oil_vegetable: {
        label: "Vegetable Oil",
        thermalDiffusivity: 0.087,
        density: 910,
        specificHeat: 1670,
        boilingPoint: 230,
        color: "#81c784",
    },
    ethanol: {
        label: "Alcohol (Ethanol)",
        thermalDiffusivity: 0.096,
        density: 789,
        specificHeat: 2440,
        boilingPoint: 78.4,
        color: "#9575cd",
    },
    glycerol: {
        label: "Glycerol",
        thermalDiffusivity: 0.095,
        density: 1261,
        specificHeat: 2380,
        boilingPoint: 290,
        color: "#4dd0e1",
    },
    mercury: {
        label: "Mercury",
        thermalDiffusivity: 4.4,
        density: 13534,
        specificHeat: 140,
        boilingPoint: 357,
        color: "#78909c",
    },
    saltwater: {
        label: "Saltwater (3.5%)",
        thermalDiffusivity: 0.138,
        density: 1025,
        specificHeat: 3993,
        boilingPoint: 100.6,
        color: "#29b6f6",
    },
};

export const AIR_CONDITIONS: Record<string, AirCondition> = {
    still: {
        label: "Still Air",
        h: 5,
    },
    light_breeze: {
        label: "Light Breeze",
        h: 15,
    },
    fan_low: {
        label: "Fan (Low)",
        h: 25,
    },
    fan_high: {
        label: "Fan (High)",
        h: 50,
    },
    strong_wind: {
        label: "Strong Wind",
        h: 100,
    },
};

export const HEAT_SOURCE_SIZES: Record<string, { label: string; scale: number }> = {
  small:  { label: "Small",  scale: 0.2 },
  medium: { label: "Medium", scale: 0.4 },
  large:  { label: "Large",  scale: 0.55 },
  full:   { label: "Full",   scale: 1.00 },
};
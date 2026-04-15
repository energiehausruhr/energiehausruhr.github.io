export type RoomType = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'hallway' | 'office' | 'storage' | 'custom';

export interface Component {
  id: string;
  name: string;
  type: 'wall' | 'window' | 'window_double' | 'window_triple' | 'door' | 'roof' | 'floor' | 'internal_wall' | 'ceiling';
  width: number;
  height: number;
  area: number;
  uValue: number;
  orientation: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'Horizontal';
  adjacentTo: 'outside' | 'unheated' | 'ground' | 'heated';
  correctionFactor: number; // f_x or f_k
  thermalBridgeFactor?: number; // Delta U_WB specific to this component
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  area: number;
  height: number;
  volume: number;
  targetTemp: number;
  ventilationType: 'natural' | 'mechanical' | 'mechanical_recovery';
  components: Component[];
  airExchangeRate: number; // n_min
  reheatingFactor: number; // f_RH in W/m2
  heatRecoveryEfficiency: number; // eta_WRG (0.0 to 1.0)
}

export interface ProjectInfo {
  clientName: string;
  projectAddress: string;
  location: string;
  date: string;
  calculatedBy: string;
  companyName: string;
  companyAddress: string;
  companyLocation: string;
  companyLogo?: string; // Base64 string
}

export interface BuildingData {
  projectInfo: ProjectInfo;
  outdoorTemp: number;
  annualMeanTemp: number; // theta_m,e
  thermalBridgeAddition: number; // Delta U_WB
  airTightness: number; // n50
  shieldingClass: 'protected' | 'moderate' | 'exposed';
  buildingMass: 'light' | 'medium' | 'heavy';
  shieldingFactor: number; // e
  heightFactor: number; // f
  description?: string;
  rooms: Room[];
}

export interface CalculationResult {
  rooms: {
    id: string;
    name: string;
    transmissionLoss: number;
    ventilationLoss: number;
    reheatingLoad: number;
    totalLoad: number;
    specificLoad: number;
    components: {
      id: string;
      loss: number;
    }[];
  }[];
  totalTransmissionLoss: number;
  totalVentilationLoss: number;
  totalReheatingLoad: number;
  totalLoad: number;
  totalArea: number;
  specificLoad: number;
}

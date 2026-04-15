import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Home, 
  Thermometer, 
  Wind, 
  Layers, 
  Info, 
  ChevronRight,
  BarChart3,
  Download,
  RefreshCcw,
  Plus,
  Trash2,
  Settings,
  ArrowRight,
  FileText,
  Building2,
  Maximize2,
  User,
  MapPin,
  Calendar,
  Upload,
  Save,
  Sun,
  Moon,
  Leaf,
  Palette,
  Square,
  Layout,
  DoorOpen,
  Triangle,
  ArrowDown,
  ArrowUp,
  Columns,
  Copy,
  AlertTriangle,
  Lock,
  Cloud,
  X,
  Search
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Room, Component, BuildingData, RoomType, ProjectInfo } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROOM_TYPES: { id: RoomType; label: string; temp: number; nMin: number }[] = [
  { id: 'living', label: 'Wohnzimmer', temp: 20, nMin: 0.5 },
  { id: 'bedroom', label: 'Schlafzimmer', temp: 20, nMin: 0.5 },
  { id: 'kitchen', label: 'Küche', temp: 20, nMin: 0.5 },
  { id: 'bathroom', label: 'Badezimmer', temp: 24, nMin: 0.5 },
  { id: 'hallway', label: 'Flur / Treppenhaus', temp: 15, nMin: 0.5 },
  { id: 'office', label: 'Büro / Arbeitszimmer', temp: 20, nMin: 0.5 },
  { id: 'storage', label: 'Abstellraum / Keller', temp: 10, nMin: 0.5 },
  { id: 'custom', label: 'Benutzerdefiniert', temp: 20, nMin: 0.5 },
];

const COMPONENT_TYPES = [
  { id: 'wall', label: 'Außenwand', icon: Square },
  { id: 'internal_wall', label: 'Innenwand', icon: Columns },
  { id: 'window', label: 'Fenster (Standard)', icon: Layout },
  { id: 'window_double', label: 'Fenster (2-fach)', icon: Layout },
  { id: 'window_triple', label: 'Fenster (3-fach)', icon: Layout },
  { id: 'roof', label: 'Dach / Decke', icon: Triangle },
  { id: 'ceiling', label: 'Geschossdecke', icon: ArrowUp },
  { id: 'floor', label: 'Bodenplatte', icon: ArrowDown },
  { id: 'door', label: 'Außentür', icon: DoorOpen },
];

const DEFAULT_U_VALUES: Record<string, number> = {
  wall: 0.20, // Modern standard (GEG 2024)
  internal_wall: 0.50,
  window: 1.10, // Standard double glazing
  window_double: 0.90, // High-perf double glazing
  window_triple: 0.70, // Standard triple glazing
  roof: 0.14, // Modern standard (GEG 2024)
  ceiling: 0.30,
  floor: 0.25, // Modern standard (GEG 2024)
  door: 1.20, // Modern standard (GEG 2024)
};

const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Horizontal'];
const ADJACENT_TYPES = [
  { id: 'outside', label: 'Außenluft', factor: 1.0 },
  { id: 'unheated', label: 'Unbeheizter Raum', factor: 0.7 }, // DIN EN 12831-1 Table B.5
  { id: 'ground', label: 'Erdreich', factor: 0.5 }, // DIN EN 12831-1 Table B.4
  { id: 'heated', label: 'Beheizter Raum', factor: 0.0 },
];

const COMMON_MATERIALS = [
  { name: 'Beton (bewehrt)', lambda: 2.30 },
  { name: 'Beton (unbewehrt)', lambda: 2.10 },
  { name: 'Leichtbeton', lambda: 0.70 },
  { name: 'Kalksandstein', lambda: 0.99 },
  { name: 'Ziegelmauerwerk (Vollziegel)', lambda: 0.81 },
  { name: 'Hochlochziegel', lambda: 0.40 },
  { name: 'Porenbeton', lambda: 0.12 },
  { name: 'Gipskartonplatten', lambda: 0.21 },
  { name: 'Gipsputz', lambda: 0.70 },
  { name: 'Kalk-Zement-Putz', lambda: 1.00 },
  { name: 'Mineralwolle (WLG 035)', lambda: 0.035 },
  { name: 'Mineralwolle (WLG 040)', lambda: 0.040 },
  { name: 'EPS (WLG 032)', lambda: 0.032 },
  { name: 'EPS (WLG 035)', lambda: 0.035 },
  { name: 'XPS (WLG 035)', lambda: 0.035 },
  { name: 'PUR/PIR (WLG 023)', lambda: 0.023 },
  { name: 'Holzfaserplatte', lambda: 0.045 },
  { name: 'Zellulose', lambda: 0.040 },
  { name: 'Nadelholz', lambda: 0.13 },
  { name: 'Hartholz', lambda: 0.18 },
  { name: 'Estrich (Zement)', lambda: 1.40 },
  { name: 'Estrich (Anhydrit)', lambda: 1.20 },
  { name: 'Fliesen', lambda: 1.00 },
];

const RADIATOR_TYPES = [
  { id: '11', label: 'Typ 11 (1-lagig)', nominalWattsPerMeter: 900 },
  { id: '21', label: 'Typ 21 (2-lagig, schmal)', nominalWattsPerMeter: 1250 },
  { id: '22', label: 'Typ 22 (2-lagig)', nominalWattsPerMeter: 1700 },
  { id: '33', label: 'Typ 33 (3-lagig)', nominalWattsPerMeter: 2450 },
];

const U_VALUE_CATALOG = [
  { label: 'Außenwand ungedämmt (bis 1977)', value: 1.40 },
  { label: 'Außenwand (1978-1983)', value: 1.00 },
  { label: 'Außenwand (1984-1994)', value: 0.60 },
  { label: 'Außenwand (1995-2001)', value: 0.50 },
  { label: 'Außenwand (ab 2002)', value: 0.35 },
  { label: 'Fenster 1-fach (bis 1978)', value: 5.20 },
  { label: 'Fenster 2-fach unbeschichtet (bis 1994)', value: 2.80 },
  { label: 'Fenster 2-fach Wärmeschutz (ab 1995)', value: 1.30 },
  { label: 'Fenster 3-fach (ab 2009)', value: 0.90 },
  { label: 'Dach ungedämmt', value: 2.50 },
  { label: 'Dach gedämmt (ab 1995)', value: 0.30 },
  { label: 'Bodenplatte ungedämmt', value: 1.20 },
];

const CLIMATE_DATA = [
  { city: 'Berlin', plz: '10115', outdoorTemp: -12.1, annualMeanTemp: 9.8 },
  { city: 'Hamburg', plz: '20095', outdoorTemp: -10.5, annualMeanTemp: 9.4 },
  { city: 'München', plz: '80331', outdoorTemp: -12.9, annualMeanTemp: 8.8 },
  { city: 'Köln', plz: '50667', outdoorTemp: -8.1, annualMeanTemp: 10.9 },
  { city: 'Frankfurt am Main', plz: '60311', outdoorTemp: -10.2, annualMeanTemp: 10.6 },
  { city: 'Stuttgart', plz: '70173', outdoorTemp: -11.5, annualMeanTemp: 10.1 },
  { city: 'Düsseldorf', plz: '40210', outdoorTemp: -8.2, annualMeanTemp: 10.9 },
  { city: 'Leipzig', plz: '04109', outdoorTemp: -12.8, annualMeanTemp: 9.6 },
  { city: 'Dortmund', plz: '44135', outdoorTemp: -9.5, annualMeanTemp: 10.2 },
  { city: 'Essen', plz: '45127', outdoorTemp: -9.1, annualMeanTemp: 10.5 },
  { city: 'Bremen', plz: '28195', outdoorTemp: -10.4, annualMeanTemp: 9.6 },
  { city: 'Dresden', plz: '01067', outdoorTemp: -13.0, annualMeanTemp: 9.5 },
  { city: 'Hannover', plz: '30159', outdoorTemp: -11.2, annualMeanTemp: 9.7 },
  { city: 'Nürnberg', plz: '90402', outdoorTemp: -12.4, annualMeanTemp: 9.4 },
  { city: 'Duisburg', plz: '47051', outdoorTemp: -8.5, annualMeanTemp: 10.8 },
  { city: 'Bochum', plz: '44787', outdoorTemp: -9.3, annualMeanTemp: 10.4 },
  { city: 'Wuppertal', plz: '42103', outdoorTemp: -9.8, annualMeanTemp: 9.9 },
  { city: 'Bielefeld', plz: '33602', outdoorTemp: -10.6, annualMeanTemp: 9.8 },
  { city: 'Bonn', plz: '53111', outdoorTemp: -8.3, annualMeanTemp: 10.7 },
  { city: 'Münster', plz: '48143', outdoorTemp: -9.9, annualMeanTemp: 10.1 },
  { city: 'Karlsruhe', plz: '76133', outdoorTemp: -10.8, annualMeanTemp: 11.1 },
  { city: 'Mannheim', plz: '68159', outdoorTemp: -10.5, annualMeanTemp: 11.2 },
  { city: 'Augsburg', plz: '86150', outdoorTemp: -13.2, annualMeanTemp: 8.9 },
  { city: 'Wiesbaden', plz: '65183', outdoorTemp: -9.8, annualMeanTemp: 10.8 },
  { city: 'Gelsenkirchen', plz: '45879', outdoorTemp: -8.9, annualMeanTemp: 10.6 },
  { city: 'Mönchengladbach', plz: '41061', outdoorTemp: -8.4, annualMeanTemp: 10.8 },
  { city: 'Braunschweig', plz: '38100', outdoorTemp: -11.5, annualMeanTemp: 9.6 },
  { city: 'Chemnitz', plz: '09111', outdoorTemp: -14.2, annualMeanTemp: 8.7 },
  { city: 'Kiel', plz: '24103', outdoorTemp: -9.8, annualMeanTemp: 9.2 },
  { city: 'Aachen', plz: '52062', outdoorTemp: -8.9, annualMeanTemp: 10.3 },
  { city: 'Halle (Saale)', plz: '06108', outdoorTemp: -12.5, annualMeanTemp: 9.9 },
  { city: 'Magdeburg', plz: '39104', outdoorTemp: -12.2, annualMeanTemp: 9.8 },
  { city: 'Freiburg im Breisgau', plz: '79098', outdoorTemp: -10.2, annualMeanTemp: 11.4 },
  { city: 'Krefeld', plz: '47798', outdoorTemp: -8.6, annualMeanTemp: 10.8 },
  { city: 'Mainz', plz: '55116', outdoorTemp: -9.9, annualMeanTemp: 10.9 },
  { city: 'Lübeck', plz: '23552', outdoorTemp: -10.2, annualMeanTemp: 9.3 },
  { city: 'Erfurt', plz: '99084', outdoorTemp: -13.5, annualMeanTemp: 9.1 },
  { city: 'Oberhausen', plz: '46045', outdoorTemp: -8.7, annualMeanTemp: 10.7 },
  { city: 'Rostock', plz: '18055', outdoorTemp: -10.1, annualMeanTemp: 9.2 },
  { city: 'Kassel', plz: '34117', outdoorTemp: -11.8, annualMeanTemp: 9.5 },
  { city: 'Hagen', plz: '58095', outdoorTemp: -9.6, annualMeanTemp: 10.1 },
  { city: 'Saarbrücken', plz: '66111', outdoorTemp: -10.5, annualMeanTemp: 10.2 },
  { city: 'Hamm', plz: '59065', outdoorTemp: -9.8, annualMeanTemp: 10.3 },
  { city: 'Potsdam', plz: '14467', outdoorTemp: -12.2, annualMeanTemp: 9.8 },
  { city: 'Ludwigshafen am Rhein', plz: '67059', outdoorTemp: -10.4, annualMeanTemp: 11.3 },
  { city: 'Oldenburg', plz: '26122', outdoorTemp: -10.2, annualMeanTemp: 9.8 },
  { city: 'Leverkusen', plz: '51373', outdoorTemp: -8.2, annualMeanTemp: 10.9 },
  { city: 'Osnabrück', plz: '49074', outdoorTemp: -10.1, annualMeanTemp: 10.0 },
  { city: 'Solingen', plz: '42651', outdoorTemp: -9.5, annualMeanTemp: 10.1 },
  { city: 'Heidelberg', plz: '69117', outdoorTemp: -10.2, annualMeanTemp: 11.2 },
  { city: 'Herne', plz: '44623', outdoorTemp: -9.1, annualMeanTemp: 10.5 },
  { city: 'Neuss', plz: '41460', outdoorTemp: -8.3, annualMeanTemp: 10.9 },
  { city: 'Darmstadt', plz: '64283', outdoorTemp: -10.1, annualMeanTemp: 10.8 },
  { city: 'Paderborn', plz: '33098', outdoorTemp: -10.9, annualMeanTemp: 9.6 },
  { city: 'Regensburg', plz: '93047', outdoorTemp: -13.5, annualMeanTemp: 9.2 },
  { city: 'Ingolstadt', plz: '85049', outdoorTemp: -13.1, annualMeanTemp: 9.1 },
  { city: 'Würzburg', plz: '97070', outdoorTemp: -12.1, annualMeanTemp: 9.9 },
  { city: 'Fürth', plz: '90762', outdoorTemp: -12.4, annualMeanTemp: 9.4 },
  { city: 'Wolfsburg', plz: '38440', outdoorTemp: -11.6, annualMeanTemp: 9.7 },
  { city: 'Offenbach am Main', plz: '63065', outdoorTemp: -10.1, annualMeanTemp: 10.7 },
  { city: 'Ulm', plz: '89073', outdoorTemp: -12.8, annualMeanTemp: 9.2 },
  { city: 'Heilbronn', plz: '74072', outdoorTemp: -11.2, annualMeanTemp: 10.4 },
  { city: 'Pforzheim', plz: '75172', outdoorTemp: -11.4, annualMeanTemp: 10.1 },
  { city: 'Göttingen', plz: '37073', outdoorTemp: -11.9, annualMeanTemp: 9.4 },
  { city: 'Bottrop', plz: '46236', outdoorTemp: -8.9, annualMeanTemp: 10.6 },
  { city: 'Recklinghausen', plz: '45657', outdoorTemp: -9.2, annualMeanTemp: 10.4 },
  { city: 'Reutlingen', plz: '72764', outdoorTemp: -11.8, annualMeanTemp: 9.8 },
  { city: 'Koblenz', plz: '56068', outdoorTemp: -9.5, annualMeanTemp: 10.6 },
  { city: 'Bremerhaven', plz: '27568', outdoorTemp: -10.1, annualMeanTemp: 9.5 },
  { city: 'Bergisch Gladbach', plz: '51465', outdoorTemp: -8.8, annualMeanTemp: 10.4 },
  { city: 'Jena', plz: '07743', outdoorTemp: -13.2, annualMeanTemp: 9.4 },
  { city: 'Remscheid', plz: '42853', outdoorTemp: -10.1, annualMeanTemp: 9.6 },
  { city: 'Erlangen', plz: '91052', outdoorTemp: -12.4, annualMeanTemp: 9.4 },
  { city: 'Moers', plz: '47441', outdoorTemp: -8.5, annualMeanTemp: 10.8 },
  { city: 'Siegen', plz: '57072', outdoorTemp: -11.2, annualMeanTemp: 9.1 },
  { city: 'Hildesheim', plz: '31134', outdoorTemp: -11.3, annualMeanTemp: 9.7 },
  { city: 'Salzgitter', plz: '38226', outdoorTemp: -11.7, annualMeanTemp: 9.6 },
  { city: 'Cottbus', plz: '03046', outdoorTemp: -13.2, annualMeanTemp: 9.7 },
  { city: 'Kaiserslautern', plz: '67655', outdoorTemp: -10.8, annualMeanTemp: 9.8 },
  { city: 'Gütersloh', plz: '33330', outdoorTemp: -10.4, annualMeanTemp: 10.1 },
  { city: 'Schwerin', plz: '19053', outdoorTemp: -10.5, annualMeanTemp: 9.1 },
  { city: 'Witten', plz: '58452', outdoorTemp: -9.4, annualMeanTemp: 10.2 },
  { city: 'Hanau', plz: '63450', outdoorTemp: -10.1, annualMeanTemp: 10.7 },
  { city: 'Ludwigsburg', plz: '71638', outdoorTemp: -11.4, annualMeanTemp: 10.2 },
  { city: 'Esslingen am Neckar', plz: '73728', outdoorTemp: -11.4, annualMeanTemp: 10.3 },
  { city: 'Iserlohn', plz: '58636', outdoorTemp: -10.2, annualMeanTemp: 9.7 },
  { city: 'Düren', plz: '52349', outdoorTemp: -8.7, annualMeanTemp: 10.4 },
  { city: 'Tübingen', plz: '72070', outdoorTemp: -11.9, annualMeanTemp: 9.8 },
  { city: 'Flensburg', plz: '24937', outdoorTemp: -9.5, annualMeanTemp: 9.1 },
  { city: 'Gießen', plz: '35390', outdoorTemp: -11.2, annualMeanTemp: 9.7 },
  { city: 'Villingen-Schwenningen', plz: '78048', outdoorTemp: -14.5, annualMeanTemp: 7.9 },
  { city: 'Konstanz', plz: '78462', outdoorTemp: -10.8, annualMeanTemp: 9.9 },
  { city: 'Ratingen', plz: '40878', outdoorTemp: -8.4, annualMeanTemp: 10.8 },
  { city: 'Lünen', plz: '44532', outdoorTemp: -9.6, annualMeanTemp: 10.3 },
  { city: 'Marl', plz: '45768', outdoorTemp: -9.1, annualMeanTemp: 10.5 },
  { city: 'Worms', plz: '67547', outdoorTemp: -10.1, annualMeanTemp: 11.1 },
  { city: 'Dessau-Roßlau', plz: '06844', outdoorTemp: -12.4, annualMeanTemp: 9.9 },
  { city: 'Velbert', plz: '42549', outdoorTemp: -9.7, annualMeanTemp: 10.0 },
  { city: 'Minden', plz: '32423', outdoorTemp: -10.8, annualMeanTemp: 10.0 },
  { city: 'Neumünster', plz: '24534', outdoorTemp: -10.4, annualMeanTemp: 9.2 },
  { city: 'Norderstedt', plz: '22844', outdoorTemp: -10.4, annualMeanTemp: 9.4 },
  { city: 'Delmenhorst', plz: '27749', outdoorTemp: -10.3, annualMeanTemp: 9.7 },
  { city: 'Bamberg', plz: '96047', outdoorTemp: -12.8, annualMeanTemp: 9.3 },
  { city: 'Viersen', plz: '41747', outdoorTemp: -8.4, annualMeanTemp: 10.8 },
  { city: 'Marburg', plz: '35037', outdoorTemp: -11.5, annualMeanTemp: 9.4 },
  { city: 'Rheine', plz: '48431', outdoorTemp: -10.1, annualMeanTemp: 10.1 },
  { city: 'Wilhelmshaven', plz: '26382', outdoorTemp: -9.8, annualMeanTemp: 9.7 },
  { city: 'Gladbeck', plz: '45964', outdoorTemp: -9.0, annualMeanTemp: 10.6 },
  { city: 'Troisdorf', plz: '53840', outdoorTemp: -8.4, annualMeanTemp: 10.8 },
  { city: 'Bayreuth', plz: '95444', outdoorTemp: -14.1, annualMeanTemp: 8.6 },
  { city: 'Dorsten', plz: '46282', outdoorTemp: -8.9, annualMeanTemp: 10.6 },
  { city: 'Detmold', plz: '32756', outdoorTemp: -10.9, annualMeanTemp: 9.6 },
  { city: 'Arnsberg', plz: '59755', outdoorTemp: -11.1, annualMeanTemp: 9.3 },
  { city: 'Landshut', plz: '84028', outdoorTemp: -13.1, annualMeanTemp: 9.1 },
  { city: 'Castrop-Rauxel', plz: '44575', outdoorTemp: -9.2, annualMeanTemp: 10.4 },
  { city: 'Lüdenscheid', plz: '58507', outdoorTemp: -11.2, annualMeanTemp: 8.8 },
  { city: 'Bocholt', plz: '46395', outdoorTemp: -9.2, annualMeanTemp: 10.4 },
  { city: 'Lippstadt', plz: '59555', outdoorTemp: -10.1, annualMeanTemp: 10.2 },
  { city: 'Herford', plz: '32051', outdoorTemp: -10.5, annualMeanTemp: 9.9 },
  { city: 'Gummersbach', plz: '51643', outdoorTemp: -10.8, annualMeanTemp: 9.2 },
  { city: 'Fulda', plz: '36037', outdoorTemp: -12.5, annualMeanTemp: 8.9 },
  { city: 'Grevenbroich', plz: '41515', outdoorTemp: -8.5, annualMeanTemp: 10.8 },
  { city: 'Neu-Ulm', plz: '89231', outdoorTemp: -12.8, annualMeanTemp: 9.2 },
  { city: 'Schweinfurt', plz: '97421', outdoorTemp: -12.3, annualMeanTemp: 9.7 },
  { city: 'Herten', plz: '45699', outdoorTemp: -9.1, annualMeanTemp: 10.5 },
  { city: 'Bergheim', plz: '50126', outdoorTemp: -8.4, annualMeanTemp: 10.7 },
  { city: 'Wesel', plz: '46483', outdoorTemp: -8.8, annualMeanTemp: 10.7 },
  { city: 'Hürth', plz: '50354', outdoorTemp: -8.1, annualMeanTemp: 10.9 },
  { city: 'Langenfeld', plz: '40764', outdoorTemp: -8.3, annualMeanTemp: 10.9 },
  { city: 'Unna', plz: '59423', outdoorTemp: -9.6, annualMeanTemp: 10.2 },
  { city: 'Euskirchen', plz: '53879', outdoorTemp: -9.2, annualMeanTemp: 10.1 },
  { city: 'Göppingen', plz: '73033', outdoorTemp: -11.6, annualMeanTemp: 10.1 },
  { city: 'Hameln', plz: '31785', outdoorTemp: -11.0, annualMeanTemp: 9.8 },
  { city: 'Stolberg', plz: '52222', outdoorTemp: -9.1, annualMeanTemp: 10.1 },
  { city: 'Eschweiler', plz: '52249', outdoorTemp: -8.9, annualMeanTemp: 10.3 },
  { city: 'Görlitz', plz: '02826', outdoorTemp: -13.8, annualMeanTemp: 9.1 },
  { city: 'Meerbusch', plz: '40667', outdoorTemp: -8.2, annualMeanTemp: 10.9 },
  { city: 'Hilden', plz: '40721', outdoorTemp: -8.3, annualMeanTemp: 10.9 },
  { city: 'Sankt Augustin', plz: '53757', outdoorTemp: -8.4, annualMeanTemp: 10.8 },
  { city: 'Waiblingen', plz: '71332', outdoorTemp: -11.3, annualMeanTemp: 10.3 },
  { city: 'Baden-Baden', plz: '76530', outdoorTemp: -10.4, annualMeanTemp: 11.1 },
  { city: 'Lingen', plz: '49808', outdoorTemp: -10.0, annualMeanTemp: 10.1 },
  { city: 'Hattingen', plz: '45525', outdoorTemp: -9.4, annualMeanTemp: 10.2 },
  { city: 'Bad Homburg', plz: '61348', outdoorTemp: -10.5, annualMeanTemp: 10.2 },
  { city: 'Langenhagen', plz: '30851', outdoorTemp: -11.2, annualMeanTemp: 9.7 },
  { city: 'Bad Salzuflen', plz: '32105', outdoorTemp: -10.7, annualMeanTemp: 9.8 },
  { city: 'Pulheim', plz: '50259', outdoorTemp: -8.2, annualMeanTemp: 10.9 },
  { city: 'Nordhorn', plz: '48527', outdoorTemp: -9.9, annualMeanTemp: 10.1 },
  { city: 'Neustadt an der Weinstraße', plz: '67433', outdoorTemp: -10.2, annualMeanTemp: 11.1 },
  { city: 'Wetzlar', plz: '35578', outdoorTemp: -11.4, annualMeanTemp: 9.6 },
  { city: 'Passau', plz: '94032', outdoorTemp: -13.8, annualMeanTemp: 9.1 },
  { city: 'Frechen', plz: '50226', outdoorTemp: -8.2, annualMeanTemp: 10.9 },
  { city: 'Kleve', plz: '47533', outdoorTemp: -8.6, annualMeanTemp: 10.7 },
  { city: 'Lörrach', plz: '79539', outdoorTemp: -10.5, annualMeanTemp: 11.1 },
  { city: 'Bad Kreuznach', plz: '55543', outdoorTemp: -9.8, annualMeanTemp: 10.9 },
  { city: 'Gummersbach', plz: '51643', outdoorTemp: -10.8, annualMeanTemp: 9.2 },
  { city: 'Ravensburg', plz: '88212', outdoorTemp: -12.5, annualMeanTemp: 9.1 },
  { city: 'Peine', plz: '31224', outdoorTemp: -11.4, annualMeanTemp: 9.7 },
  { city: 'Itzehoe', plz: '25524', outdoorTemp: -10.2, annualMeanTemp: 9.3 },
];

type Theme = 'classic' | 'dark' | 'blueprint' | 'forest' | 'midnight' | 'clay' | 'serene' | 'viessmann';

const DEFAULT_BUILDING_DATA: BuildingData = {
  projectInfo: {
    clientName: '',
    projectAddress: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    calculatedBy: '',
    companyName: '',
    companyAddress: '',
    companyLocation: '',
    companyLogo: ''
  },
  description: '',
  outdoorTemp: -12,
  annualMeanTemp: 8.5,
  thermalBridgeAddition: 0.05,
  airTightness: 1.5,
  shieldingClass: 'moderate',
  buildingMass: 'medium',
  shieldingFactor: 0.07,
  heightFactor: 1.0,
  rooms: [
    {
      id: '1',
      name: 'Wohnzimmer',
      type: 'living',
      area: 30,
      height: 2.5,
      volume: 75,
      targetTemp: 20,
      ventilationType: 'natural',
      airExchangeRate: 0.5,
      reheatingFactor: 0,
      heatRecoveryEfficiency: 0.8,
      components: [
        { id: 'c1', name: 'Außenwand S', type: 'wall', width: 5, height: 3, area: 15, uValue: 0.24, orientation: 'S', adjacentTo: 'outside', correctionFactor: 1.0 },
        { id: 'c2', name: 'Fenster S', type: 'window', width: 2, height: 3, area: 6, uValue: 1.1, orientation: 'S', adjacentTo: 'outside', correctionFactor: 1.0 },
        { id: 'c3', name: 'Außenwand W', type: 'wall', width: 4, height: 3, area: 12, uValue: 0.24, orientation: 'W', adjacentTo: 'outside', correctionFactor: 1.0 }
      ]
    }
  ]
};

interface UValueLayer {
  id: string;
  name: string;
  thickness: number;
  lambda: number;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('heizlast_theme');
    return (saved as Theme) || 'serene';
  });

  const [building, setBuilding] = useState<BuildingData>(() => {
    const saved = localStorage.getItem('heizlast_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading saved data", e);
      }
    }
    return DEFAULT_BUILDING_DATA;
  });

  const [activeRoomId, setActiveRoomId] = useState<string | null>(building.rooms[0]?.id || null);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [showUValueCalculator, setShowUValueCalculator] = useState(false);
  const [showClimateSelector, setShowClimateSelector] = useState(false);
  const [climateSearch, setClimateSearch] = useState('');
  const [showRadiatorCalculator, setShowRadiatorCalculator] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const expectedPassword = `${dd}${mm}`;

    if (passwordInput === expectedPassword) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const [radiatorParams, setRadiatorParams] = useState({
    targetLoad: 1000,
    flowTemp: 55,
    returnTemp: 45,
    roomTemp: 20,
    type: '22',
    height: 600,
    length: 1000
  });

  const radiatorOutput = useMemo(() => {
    const { flowTemp, returnTemp, roomTemp, type, length } = radiatorParams;
    const nominalDT = 49.83; // (75+65)/2 - 20 = 50, log is 49.83
    
    const dt_v = flowTemp - roomTemp;
    const dt_r = returnTemp - roomTemp;
    
    if (dt_v <= 0 || dt_r <= 0) return 0;
    
    let dt_log;
    if (dt_v / dt_r > 0.7) {
      dt_log = (flowTemp + returnTemp) / 2 - roomTemp;
    } else {
      dt_log = (dt_v - dt_r) / Math.log(dt_v / dt_r);
    }
    
    const radType = RADIATOR_TYPES.find(t => t.id === type);
    if (!radType) return 0;
    
    const nominalWatts = radType.nominalWattsPerMeter * (length / 1000);
    const exponent = 1.3;
    
    return Math.round(nominalWatts * Math.pow(dt_log / nominalDT, exponent));
  }, [radiatorParams]);

  const massFlow = useMemo(() => {
    const dt = radiatorParams.flowTemp - radiatorParams.returnTemp;
    if (dt <= 0) return 0;
    // Massenstrom = Q / (c * dT) -> c Wasser = 1.163 Wh/(kg*K)
    return Math.round(radiatorParams.targetLoad / (1.163 * dt));
  }, [radiatorParams.targetLoad, radiatorParams.flowTemp, radiatorParams.returnTemp]);

  const [uValueLayers, setUValueLayers] = useState<UValueLayer[]>([
    { id: '1', name: 'Putz (innen)', thickness: 1.5, lambda: 0.70 },
    { id: '2', name: 'Mauerwerk', thickness: 24, lambda: 0.50 },
    { id: '3', name: 'Dämmung', thickness: 12, lambda: 0.035 },
    { id: '4', name: 'Putz (außen)', thickness: 2, lambda: 0.80 }
  ]);
  const [rsi, setRsi] = useState(0.13);
  const [rse, setRse] = useState(0.04);

  const calculatedUValue = useMemo(() => {
    const rTotal = rsi + rse + uValueLayers.reduce((acc, layer) => {
      const lambda = Number(layer.lambda);
      const thickness = Number(layer.thickness);
      if (isNaN(lambda) || isNaN(thickness) || lambda <= 0) return acc;
      return acc + (thickness / 100) / lambda;
    }, 0);
    
    if (rTotal <= 0) return '0.000';
    const u = 1 / rTotal;
    return isFinite(u) ? u.toFixed(3) : '0.000';
  }, [uValueLayers, rsi, rse]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('heizlast_theme', theme);
  }, [theme]);

  React.useEffect(() => {
    localStorage.setItem('heizlast_data', JSON.stringify(building));
  }, [building]);

  const results = useMemo(() => {
    const roomResults = building.rooms.map(room => {
      const tempDiff = room.targetTemp - building.outdoorTemp;
      
      // 1. Transmission Heat Loss
      const componentLosses = room.components.map(comp => {
        const deltaU = comp.thermalBridgeFactor !== undefined ? comp.thermalBridgeFactor : building.thermalBridgeAddition;
        const effectiveU = comp.uValue + deltaU;
        
        let correctionFactor = comp.correctionFactor;
        
        // Dynamic correction factor for ground components based on annual mean temp
        if (comp.adjacentTo === 'ground') {
          const denominator = room.targetTemp - building.outdoorTemp;
          if (denominator !== 0) {
            correctionFactor = (room.targetTemp - building.annualMeanTemp) / denominator;
            // Apply ground correction (f_gw) - typically 1.0 to 1.15
            correctionFactor *= 1.0; 
          }
        }
        
        const loss = comp.area * effectiveU * correctionFactor * tempDiff;
        return { id: comp.id, loss };
      });

      const transmissionLoss = componentLosses.reduce((sum, c) => sum + c.loss, 0);

      // 2. Ventilation Heat Loss (DIN EN 12831)
      const volume = room.area * room.height;
      const vMin = volume * room.airExchangeRate;
      
      // Effective air flow considering heat recovery
      const reductionFactor = room.ventilationType === 'mechanical_recovery' ? (1 - room.heatRecoveryEfficiency) : 1;
      const vMinEffective = vMin * reductionFactor;
      
      const vInf = 2 * volume * building.airTightness * building.shieldingFactor * building.heightFactor;
      const vAir = Math.max(vMinEffective, vInf);
      const ventilationLoss = vAir * 0.34 * tempDiff;

      // 3. Reheating Load
      const reheatingLoad = room.area * room.reheatingFactor;

      const totalLoad = transmissionLoss + ventilationLoss + reheatingLoad;

      return {
        id: room.id,
        name: room.name,
        transmissionLoss: Math.round(transmissionLoss),
        ventilationLoss: Math.round(ventilationLoss),
        reheatingLoad: Math.round(reheatingLoad),
        totalLoad: Math.round(totalLoad),
        specificLoad: Math.round((totalLoad / room.area) * 10) / 10,
        components: componentLosses
      };
    });

    const totalTransmission = roomResults.reduce((sum, r) => sum + r.transmissionLoss, 0);
    const totalVentilation = roomResults.reduce((sum, r) => sum + r.ventilationLoss, 0);
    const totalReheating = roomResults.reduce((sum, r) => sum + r.reheatingLoad, 0);
    const totalLoad = totalTransmission + totalVentilation + totalReheating;
    const totalArea = building.rooms.reduce((sum, r) => sum + r.area, 0);

    return {
      rooms: roomResults,
      totalTransmissionLoss: totalTransmission,
      totalVentilationLoss: totalVentilation,
      totalReheatingLoad: totalReheating,
      totalLoad: totalLoad,
      totalArea: totalArea,
      specificLoad: totalArea > 0 ? Math.round((totalLoad / totalArea) * 10) / 10 : 0,
      distribution: [
        { name: 'Transmission', value: totalTransmission },
        { name: 'Lüftung', value: totalVentilation },
        { name: 'Aufheizung', value: totalReheating }
      ]
    };
  }, [building]);

  const activeRoom = building.rooms.find(r => r.id === activeRoomId);

  const handleAddRoom = () => {
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Neuer Raum',
      type: 'living',
      area: 20,
      height: 2.5,
      volume: 50,
      targetTemp: 20,
      ventilationType: 'natural',
      airExchangeRate: 0.5,
      reheatingFactor: 0,
      heatRecoveryEfficiency: 0.8,
      components: []
    };
    setBuilding({ ...building, rooms: [...building.rooms, newRoom] });
    setActiveRoomId(newRoom.id);
  };

  const handleDuplicateRoom = (roomId: string) => {
    const roomToCopy = building.rooms.find(r => r.id === roomId);
    if (!roomToCopy) return;
    
    const newRoom: Room = {
      ...roomToCopy,
      id: Math.random().toString(36).substr(2, 9),
      name: `${roomToCopy.name} (Kopie)`,
      components: roomToCopy.components.map(c => ({
        ...c,
        id: Math.random().toString(36).substr(2, 9)
      }))
    };
    
    setBuilding({
      ...building,
      rooms: [...building.rooms, newRoom]
    });
    setActiveRoomId(newRoom.id);
  };

  const handleAddComponent = (roomId: string) => {
    const defaultType = 'wall';
    const newComp: Component = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Neues Bauteil',
      type: defaultType,
      width: 4,
      height: 2.5,
      area: 10,
      uValue: DEFAULT_U_VALUES[defaultType],
      orientation: 'S',
      adjacentTo: 'outside',
      correctionFactor: 1.0
    };
    setBuilding({
      ...building,
      rooms: building.rooms.map(r => r.id === roomId ? { ...r, components: [...r.components, newComp] } : r)
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const { projectInfo } = building;
    
    // Modern Color Palette
    const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
    const accentColor: [number, number, number] = [148, 163, 184]; // Slate 400
    const lightGray: [number, number, number] = [241, 245, 249]; // Slate 100
    const borderColor: [number, number, number] = [226, 232, 240]; // Slate 200

    // Helper for Footer
    const addFooter = (doc: any, pageNumber: number, totalPages: number) => {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(`Seite ${pageNumber} von ${totalPages}`, 14, pageHeight - 10);
      doc.text(`Erstellt am ${new Date().toLocaleString('de-DE')}`, pageSize.width - 14, pageHeight - 10, { align: 'right' });
    };

    // --- Page 1: Title & Summary ---
    
    // Company Logo
    if (projectInfo.companyLogo) {
      try {
        if (projectInfo.companyLogo.startsWith('data:image')) {
          const imgProps = doc.getImageProperties(projectInfo.companyLogo);
          const maxWidth = 45;
          const maxHeight = 20;
          let width = maxWidth;
          let height = (imgProps.height * width) / imgProps.width;
          
          if (height > maxHeight) {
            height = maxHeight;
            width = (imgProps.width * height) / imgProps.height;
          }
          
          const xPos = 196 - width;
          doc.addImage(projectInfo.companyLogo, 'PNG', xPos, 14, width, height);
        }
      } catch (e) {
        console.error("Could not add logo to PDF", e);
      }
    }

    // Main Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Heizlastberechnung', 14, 24);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('NACH DIN EN 12831-1', 14, 30);

    // Subtle Divider
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 38, 196, 38);
    
    // Project Info Block
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('PROJEKT-DETAILS', 14, 46);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    
    // Left Column (Client)
    doc.text(`Kunde:`, 14, 54);
    doc.setFont('helvetica', 'bold');
    doc.text(`${projectInfo.clientName || '-'}`, 35, 54);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Adresse:`, 14, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(`${projectInfo.projectAddress || '-'}`, 35, 60);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Ort:`, 14, 66);
    doc.setFont('helvetica', 'bold');
    doc.text(`${projectInfo.location || '-'}`, 35, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Datum:`, 14, 72);
    doc.setFont('helvetica', 'bold');
    doc.text(`${projectInfo.date}`, 35, 72);

    // Right Column (Company)
    if (projectInfo.companyName || projectInfo.companyAddress || projectInfo.calculatedBy) {
      let currentY = 54;
      const rightX = 120;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Firma:`, rightX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${projectInfo.companyName || '-'}`, rightX + 20, currentY);
      currentY += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Adresse:`, rightX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${projectInfo.companyAddress || '-'}`, rightX + 20, currentY);
      currentY += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Ort:`, rightX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${projectInfo.companyLocation || '-'}`, rightX + 20, currentY);
      currentY += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Erstellt von:`, rightX, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${projectInfo.calculatedBy || '-'}`, rightX + 20, currentY);
    }

    // Summary Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Gebäude-Parameter', 14, 90);
    
    // Global Parameters (Clean Grid)
    doc.setFontSize(9);
    
    // Left Column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Norm-Außentemperatur:`, 14, 100);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${building.outdoorTemp} °C`, 65, 100);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Jahresmittel-Temp.:`, 14, 106);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${building.annualMeanTemp} °C`, 65, 106);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Luftdichtheit (n50):`, 14, 112);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${building.airTightness} 1/h`, 65, 112);

    // Right Column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Wärmebrückenzuschlag:`, 110, 100);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${building.thermalBridgeAddition} W/m²K`, 155, 100);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Abschirmklasse:`, 110, 106);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const sClass = building.shieldingClass === 'protected' ? 'Geschützt' : building.shieldingClass === 'moderate' ? 'Moderat' : 'Exponiert';
    doc.text(sClass, 155, 106);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`Gebäudemasse:`, 110, 112);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const bMass = building.buildingMass === 'light' ? 'Leicht' : building.buildingMass === 'medium' ? 'Mittel' : 'Schwer';
    doc.text(bMass, 155, 112);

    // Building Description (if exists)
    let nextY = 125;
    if (building.description) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      const splitDescription = doc.splitTextToSize(building.description, 182);
      doc.text(splitDescription, 14, 120);
      nextY = 120 + (splitDescription.length * 4) + 5;
    }

    // Main Results Table
    const summaryData = [
      ['Gesamtheizlast', `${(results.totalLoad / 1000).toFixed(2)} kW`, 'Transmission', `${(results.totalTransmissionLoss / 1000).toFixed(2)} kW`],
      ['Lüftungswärmebedarf', `${(results.totalVentilationLoss / 1000).toFixed(2)} kW`, 'Aufheizleistung', `${(results.totalReheatingLoad / 1000).toFixed(2)} kW`],
      ['Gesamtfläche', `${results.totalArea} m²`, 'Spezifische Heizlast', `${results.specificLoad} W/m²`]
    ];

    autoTable(doc, {
      startY: nextY,
      head: [['Parameter', 'Wert', 'Parameter', 'Wert']],
      body: summaryData,
      theme: 'plain',
      headStyles: { 
        textColor: primaryColor, 
        fontStyle: 'bold',
        lineWidth: { bottom: 0.5 },
        lineColor: borderColor
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 4,
        textColor: primaryColor
      },
      columnStyles: {
        0: { textColor: accentColor },
        1: { fontStyle: 'bold' },
        2: { textColor: accentColor },
        3: { fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: lightGray
      }
    });

    // --- Page 2+: Room Details ---
    
    let currentY = (doc as any).lastAutoTable.finalY + 20;
    
    results.rooms.forEach((room, index) => {
      // Check for page break
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Room Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(room.name, 14, currentY);
      
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.5);
      doc.line(14, currentY + 2, 196, currentY + 2);
      currentY += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(`Fläche: ${building.rooms[index].area} m²  |  Temp: ${building.rooms[index].targetTemp} °C  |  Heizlast: ${room.totalLoad} W`, 14, currentY);
      currentY += 5;
      doc.text(`Lüftung: ${building.rooms[index].ventilationType}  |  n_min: ${building.rooms[index].airExchangeRate}  |  Aufheizf.: ${building.rooms[index].reheatingFactor} W/m²`, 14, currentY);
      currentY += 6;

      const roomCompData = building.rooms[index].components.map(c => {
        const loss = room.components.find(rc => rc.id === c.id)?.loss || 0;
        const typeLabel = COMPONENT_TYPES.find(t => t.id === c.type)?.label || c.type;
        const adjLabel = ADJACENT_TYPES.find(t => t.id === c.adjacentTo)?.label || c.adjacentTo;
        const deltaU = c.thermalBridgeFactor !== undefined ? c.thermalBridgeFactor : building.thermalBridgeAddition;
        return [c.name, typeLabel, adjLabel, `${c.correctionFactor}`, `${c.area} m²`, `${c.uValue}`, `${deltaU}`, `${Math.round(loss)} W`];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Bauteil', 'Typ', 'Angrenzend', 'fx', 'Fläche', 'U-Wert', 'ΔU WB', 'Verlust']],
        body: roomCompData,
        theme: 'plain',
        headStyles: { 
          textColor: primaryColor, 
          fontStyle: 'bold', 
          fontSize: 8,
          lineWidth: { bottom: 0.5 },
          lineColor: borderColor
        },
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
          textColor: primaryColor
        },
        alternateRowStyles: {
          fillColor: lightGray
        },
        columnStyles: {
          7: { fontStyle: 'bold', halign: 'right' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Add footers to all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(doc, i, pageCount);
    }

    doc.save(`Heizlastberechnung_${projectInfo.clientName || 'Projekt'}.pdf`);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(building, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `Heizlast_Projekt_${building.projectInfo.clientName || 'Export'}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content);
        setBuilding(importedData);
        if (importedData.rooms?.length > 0) {
          setActiveRoomId(importedData.rooms[0].id);
        }
      } catch (error) {
        console.error("Fehler beim Importieren:", error);
        alert("Ungültige Projektdatei.");
      }
    };
    fileReader.readAsText(file);
  };

  const chartColors = useMemo(() => {
    switch(theme) {
      case 'dark': return ['#38BDF8', '#818CF8', '#F472B6'];
      case 'blueprint': return ['#219EBC', '#8ECAE6', '#FFB703'];
      case 'forest': return ['#BC6C25', '#606C38', '#283618'];
      case 'midnight': return ['#F0ABFC', '#818CF8', '#2DD4BF'];
      case 'clay': return ['#EA580C', '#9A3412', '#C2410C'];
      case 'serene': return ['#14B8A6', '#6366F1', '#F43F5E'];
      case 'viessmann': return ['#E30613', '#333333', '#666666'];
      default: return ['#2563EB', '#10B981', '#F59E0B'];
    }
  }, [theme]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-app-bg text-main-text flex items-center justify-center p-4">
        <div className="bg-card-bg border border-border-main p-8 rounded-2xl shadow-lg max-w-md w-full space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-center">Zugriff geschützt</h1>
            <p className="text-sm opacity-70 text-center">Bitte geben Sie Ihr Passwort ein, um fortzufahren.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-input-bg border border-border-main rounded-xl p-4 text-center text-2xl tracking-widest outline-none focus:border-accent transition-colors"
                placeholder="****"
                maxLength={4}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-xs text-center mt-2">Falsches Passwort. Bitte versuchen Sie es erneut.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-accent text-accent-fg py-4 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              Entsperren
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-main-text font-sans selection:bg-accent selection:text-accent-fg">
      {/* Header */}
      <header className="border-b border-border-main p-6 flex justify-between items-center bg-card-bg/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-accent text-accent-fg p-2 rounded-lg">
            <Calculator size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Heizlast-Profi DIN 12831</h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Normgerechte Berechnung für SHK & Förderung</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-input-bg rounded-xl p-1 border border-border-main/20">
            <button 
              onClick={() => setTheme('serene')}
              className={cn("p-2 rounded-lg transition-all", theme === 'serene' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'serene' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Serene (Ruhig)"
            >
              <Wind size={16} />
            </button>
            <button 
              onClick={() => setTheme('classic')}
              className={cn("p-2 rounded-lg transition-all", theme === 'classic' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'classic' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Classic"
            >
              <Sun size={16} />
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={cn("p-2 rounded-lg transition-all", theme === 'dark' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'dark' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Dark"
            >
              <Moon size={16} />
            </button>
            <button 
              onClick={() => setTheme('blueprint')}
              className={cn("p-2 rounded-lg transition-all", theme === 'blueprint' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'blueprint' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Blueprint"
            >
              <Layers size={16} />
            </button>
            <button 
              onClick={() => setTheme('forest')}
              className={cn("p-2 rounded-lg transition-all", theme === 'forest' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'forest' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Forest"
            >
              <Leaf size={16} />
            </button>
            <button 
              onClick={() => setTheme('midnight')}
              className={cn("p-2 rounded-lg transition-all", theme === 'midnight' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'midnight' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Midnight"
            >
              <Palette size={16} />
            </button>
            <button 
              onClick={() => setTheme('clay')}
              className={cn("p-2 rounded-lg transition-all", theme === 'clay' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'clay' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Clay"
            >
              <Square size={16} />
            </button>
            <button 
              onClick={() => setTheme('viessmann')}
              className={cn("p-2 rounded-lg transition-all", theme === 'viessmann' ? "bg-accent text-accent-fg" : "hover:bg-black/5")}
              style={theme === 'viessmann' ? { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' } : { color: 'var(--text-main)' }}
              title="Viessmann"
            >
              <Building2 size={16} />
            </button>
          </div>
          <button 
            onClick={() => setShowProjectInfo(!showProjectInfo)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold uppercase",
              showProjectInfo ? "bg-accent text-accent-fg" : "bg-card-bg hover:bg-black/5"
            )}
            style={showProjectInfo ? 
              { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)', borderColor: 'var(--border)' } : 
              { backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', borderColor: 'var(--border)' }
            }
          >
            <FileText size={16} /> Projekt-Info
          </button>
          <button 
            onClick={() => setShowGlobalSettings(!showGlobalSettings)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border border-border-main text-xs font-bold uppercase transition-all",
              showGlobalSettings ? "bg-accent text-accent-fg" : "bg-card-bg hover:bg-black/5"
            )}
          >
            <Building2 size={16} /> Gebäude-Parameter
          </button>
          <button 
            onClick={handleExportPDF}
            className="p-2 bg-accent text-accent-fg hover:opacity-80 rounded-xl transition-colors"
            title="PDF Export"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={handleExportJSON}
            className="p-2 bg-accent text-accent-fg hover:opacity-80 rounded-xl transition-colors"
            title="Projekt Exportieren (JSON)"
          >
            <Save size={20} />
          </button>
          <label className="p-2 bg-accent text-accent-fg hover:opacity-80 rounded-xl transition-colors cursor-pointer" title="Projekt Importieren (JSON)">
            <Upload size={20} />
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportJSON} 
              className="hidden" 
            />
          </label>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Radiator Calculator Modal */}
        {showRadiatorCalculator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card-bg border border-border-main rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border-main flex justify-between items-center bg-accent/5">
                <div className="flex items-center gap-3">
                  <div className="bg-accent text-accent-fg p-2 rounded-lg">
                    <Thermometer size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">Heizkörper Rechner</h2>
                    <p className="text-[10px] opacity-50 uppercase font-bold tracking-widest">Leistungsauslegung nach DIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRadiatorCalculator(false)}
                  className="p-2 hover:bg-black/5 rounded-xl transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Vorlauf (°C)</label>
                    <input 
                      type="number"
                      value={radiatorParams.flowTemp}
                      onChange={(e) => setRadiatorParams({...radiatorParams, flowTemp: Number(e.target.value)})}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Rücklauf (°C)</label>
                    <input 
                      type="number"
                      value={radiatorParams.returnTemp}
                      onChange={(e) => setRadiatorParams({...radiatorParams, returnTemp: Number(e.target.value)})}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Raumtemp. (°C)</label>
                    <input 
                      type="number"
                      value={radiatorParams.roomTemp}
                      onChange={(e) => setRadiatorParams({...radiatorParams, roomTemp: Number(e.target.value)})}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Heizkörper-Typ</label>
                    <select 
                      value={radiatorParams.type}
                      onChange={(e) => setRadiatorParams({...radiatorParams, type: e.target.value})}
                      className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                    >
                      {RADIATOR_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Benötigte Heizlast (W)</label>
                    <input 
                      type="number"
                      value={radiatorParams.targetLoad}
                      onChange={(e) => setRadiatorParams({...radiatorParams, targetLoad: Number(e.target.value)})}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border-main/10">
                  <h3 className="text-[10px] font-bold uppercase opacity-50 tracking-widest">Dimensionierung</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Länge (mm)</label>
                      <input 
                        type="range" min="400" max="3000" step="100"
                        value={radiatorParams.length}
                        onChange={(e) => setRadiatorParams({...radiatorParams, length: Number(e.target.value)})}
                        className="w-full accent-accent"
                      />
                      <div className="text-center font-mono text-sm">{radiatorParams.length} mm</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase opacity-50">Bauhöhe (mm)</label>
                      <select 
                        value={radiatorParams.height}
                        onChange={(e) => setRadiatorParams({...radiatorParams, height: Number(e.target.value)})}
                        className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                      >
                        <option value="300">300 mm</option>
                        <option value="400">400 mm</option>
                        <option value="500">500 mm</option>
                        <option value="600">600 mm</option>
                        <option value="900">900 mm</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-accent/5 border-t border-border-main flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase opacity-50">Leistung</p>
                    <p className={cn(
                      "text-3xl font-bold tracking-tighter",
                      radiatorOutput >= radiatorParams.targetLoad ? "text-green-500" : "text-red-500"
                    )}>
                      {radiatorOutput} W
                    </p>
                    <p className="text-[8px] font-bold uppercase opacity-50">bei {radiatorParams.flowTemp}/{radiatorParams.returnTemp}/{radiatorParams.roomTemp}</p>
                  </div>
                  <div className="h-12 w-px bg-border-main/20 hidden md:block" />
                  <div className="text-[10px] space-y-1 opacity-70">
                    <p>Deckung: {Math.round((radiatorOutput / radiatorParams.targetLoad) * 100)}%</p>
                    <p>Differenz: {radiatorOutput - radiatorParams.targetLoad} W</p>
                    <p className="font-bold text-accent">Massenstrom: {massFlow} l/h</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRadiatorCalculator(false)}
                  className="w-full md:w-auto bg-accent text-accent-fg px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:opacity-90 transition-all"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* U-Value Calculator Modal */}
        {showUValueCalculator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card-bg border border-border-main rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border-main flex justify-between items-center bg-accent/5">
                <div className="flex items-center gap-3">
                  <div className="bg-accent text-accent-fg p-2 rounded-lg">
                    <Calculator size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">U-Wert Rechner</h2>
                    <p className="text-[10px] opacity-50 uppercase font-bold tracking-widest">Bauteil-Konfigurator</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUValueCalculator(false)}
                  className="p-2 hover:bg-black/5 rounded-xl transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Rsi (Innenwiderstand)</label>
                    <input 
                      type="number" step="0.01"
                      value={rsi}
                      onChange={(e) => setRsi(Number(e.target.value))}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase opacity-50">Rse (Außenwiderstand)</label>
                    <input 
                      type="number" step="0.01"
                      value={rse}
                      onChange={(e) => setRse(Number(e.target.value))}
                      className="w-full bg-input-bg p-3 rounded-xl font-mono text-sm outline-none border border-transparent focus:border-border-main"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold uppercase opacity-50 tracking-widest">Schichtaufbau (von Innen nach Außen)</h3>
                    <button 
                      onClick={() => setUValueLayers([...uValueLayers, { id: Math.random().toString(36).substr(2, 9), name: 'Neue Schicht', thickness: 1, lambda: 0.04 }])}
                      className="text-[10px] font-bold uppercase text-accent hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Schicht hinzufügen
                    </button>
                  </div>

                  <div className="space-y-2">
                    {uValueLayers.map((layer, idx) => (
                      <div key={layer.id} className="bg-input-bg/30 p-3 rounded-xl border border-border-main/10 space-y-2">
                        <div className="flex gap-2">
                          <select 
                            className="flex-1 bg-input-bg p-2 rounded-lg text-[10px] outline-none border border-transparent focus:border-border-main opacity-70 hover:opacity-100 transition-opacity"
                            onChange={(e) => {
                              const mat = COMMON_MATERIALS.find(m => m.name === e.target.value);
                              if (mat) {
                                const newLayers = [...uValueLayers];
                                newLayers[idx].name = mat.name;
                                newLayers[idx].lambda = mat.lambda;
                                setUValueLayers(newLayers);
                              }
                            }}
                            value={COMMON_MATERIALS.some(m => m.name === layer.name) ? layer.name : ""}
                          >
                            <option value="" disabled>Material wählen...</option>
                            {COMMON_MATERIALS.map(m => (
                              <option key={m.name} value={m.name}>{m.name} (λ={m.lambda})</option>
                            ))}
                            <option value="custom">-- Benutzerdefiniert --</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <input 
                              type="text"
                              value={layer.name}
                              onChange={(e) => {
                                const newLayers = [...uValueLayers];
                                newLayers[idx].name = e.target.value;
                                setUValueLayers(newLayers);
                              }}
                              placeholder="Material Name"
                              className="w-full bg-input-bg p-2 rounded-lg text-xs outline-none border border-transparent focus:border-border-main"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <input 
                                type="number" step="0.1"
                                value={layer.thickness}
                                onChange={(e) => {
                                  const newLayers = [...uValueLayers];
                                  newLayers[idx].thickness = Number(e.target.value);
                                  setUValueLayers(newLayers);
                                }}
                                className="w-full bg-input-bg p-2 pr-8 rounded-lg text-xs font-mono outline-none border border-transparent focus:border-border-main"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold opacity-30">cm</span>
                            </div>
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <input 
                                type="number" step="0.001"
                                value={layer.lambda}
                                onChange={(e) => {
                                  const newLayers = [...uValueLayers];
                                  newLayers[idx].lambda = Number(e.target.value);
                                  setUValueLayers(newLayers);
                                }}
                                className="w-full bg-input-bg p-2 pr-12 rounded-lg text-xs font-mono outline-none border border-transparent focus:border-border-main"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold opacity-30">W/mK</span>
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button 
                              onClick={() => setUValueLayers(uValueLayers.filter(l => l.id !== layer.id))}
                              className="text-red-500/50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-accent/5 border-t border-border-main flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase opacity-50">Ergebnis</p>
                    <p className="text-3xl font-bold tracking-tighter text-accent">{calculatedUValue}</p>
                    <p className="text-[8px] font-bold uppercase opacity-50">W/(m²K)</p>
                  </div>
                  <div className="h-12 w-px bg-border-main/20 hidden md:block" />
                  <div className="text-[10px] space-y-1 opacity-70">
                    <p>Gesamtwiderstand RT: {Number(calculatedUValue) > 0 ? (1/Number(calculatedUValue)).toFixed(3) : '0.000'} m²K/W</p>
                    <p>Anzahl Schichten: {uValueLayers.length}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUValueCalculator(false)}
                  className="w-full md:w-auto bg-accent text-accent-fg px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:opacity-90 transition-all"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Info Panel */}
        {showProjectInfo && (
          <div className="lg:col-span-12 bg-card-bg border border-border-main rounded-2xl p-8 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Name des Bauherrn oder Kunden."><User size={12}/> Bauherr / Kunde</label>
                <input 
                  type="text" 
                  value={building.projectInfo.clientName}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, clientName: e.target.value}})}
                  placeholder="Name des Kunden"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Name des Bauherrn oder Kunden."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Adresse des Bauvorhabens."><MapPin size={12}/> Projekt-Adresse</label>
                <input 
                  type="text" 
                  value={building.projectInfo.projectAddress}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, projectAddress: e.target.value}})}
                  placeholder="Straße, Hausnummer"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Adresse des Bauvorhabens."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Ort des Bauvorhabens."><MapPin size={12}/> Ort</label>
                <input 
                  type="text" 
                  value={building.projectInfo.location}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, location: e.target.value}})}
                  placeholder="PLZ, Ort"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Ort des Bauvorhabens."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Datum der Berechnung."><Calendar size={12}/> Datum</label>
                <input 
                  type="date" 
                  value={building.projectInfo.date}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, date: e.target.value}})}
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Datum der Berechnung."
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border-main/20 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Name Ihres Unternehmens."><Building2 size={12}/> Firmenname</label>
                <input 
                  type="text" 
                  value={building.projectInfo.companyName}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, companyName: e.target.value}})}
                  placeholder="Ihr Firmenname"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Name Ihres Unternehmens."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Anschrift Ihres Unternehmens."><MapPin size={12}/> Firmenanschrift</label>
                <input 
                  type="text" 
                  value={building.projectInfo.companyAddress}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, companyAddress: e.target.value}})}
                  placeholder="Straße, Hausnummer"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Anschrift Ihres Unternehmens."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Ort Ihres Unternehmens."><MapPin size={12}/> Firmen-Ort</label>
                <input 
                  type="text" 
                  value={building.projectInfo.companyLocation}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, companyLocation: e.target.value}})}
                  placeholder="PLZ, Ort"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Ort Ihres Unternehmens."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2" title="Name des Erstellers der Berechnung.">Berechnet von</label>
                <input 
                  type="text" 
                  value={building.projectInfo.calculatedBy}
                  onChange={(e) => setBuilding({...building, projectInfo: {...building.projectInfo, calculatedBy: e.target.value}})}
                  placeholder="Ihr Name"
                  className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
                  title="Name des Erstellers der Berechnung."
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border-main/20 flex flex-col md:flex-row gap-8 items-start">
              <div className="space-y-4 flex-1">
                <label className="text-[10px] font-bold uppercase opacity-50 block">Firmenlogo</label>
                <div className="flex items-center gap-4">
                  {building.projectInfo.companyLogo ? (
                    <div className="relative group">
                      <img 
                        src={building.projectInfo.companyLogo} 
                        alt="Logo Preview" 
                        className="h-20 w-auto rounded-lg border border-border-main object-contain bg-white p-2"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => setBuilding({...building, projectInfo: {...building.projectInfo, companyLogo: ''}})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="h-20 w-40 border-2 border-dashed border-border-main/30 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-black/5 transition-all">
                      <Upload size={20} className="opacity-30" />
                      <span className="text-[10px] font-bold uppercase opacity-30">Logo hochladen</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setBuilding({
                                ...building,
                                projectInfo: {
                                  ...building.projectInfo,
                                  companyLogo: event.target?.result as string
                                }
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[10px] opacity-40 max-w-xs">
                    Laden Sie Ihr Firmenlogo hoch (PNG, JPG). Dieses wird im PDF-Export oben rechts angezeigt.
                  </p>
                </div>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => setShowProjectInfo(false)}
                  className="bg-accent text-accent-fg px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg hover:opacity-90 transition-all"
                >
                  Projekt-Daten speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Settings Modal/Panel */}
        {showGlobalSettings && (
          <div className="lg:col-span-12 bg-card-bg border border-border-main rounded-2xl p-8 grid grid-cols-1 md:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50" title="Norm-Außentemperatur (theta_e): Tiefste Außentemperatur am Standort nach DIN EN 12831-1. Bereich: -20 bis 0 °C.">Norm-Außentemperatur (°C)</label>
              <input 
                type="number" 
                value={building.outdoorTemp}
                onChange={(e) => setBuilding({...building, outdoorTemp: Number(e.target.value)})}
                className="w-full bg-input-bg p-3 rounded-xl font-mono text-lg outline-none border border-transparent focus:border-border-main"
                title="Norm-Außentemperatur (theta_e): Tiefste Außentemperatur am Standort nach DIN EN 12831-1. Bereich: -20 bis 0 °C."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50" title="Jahresmittel der Außentemperatur (theta_m,e): Wichtig für Verluste gegen Erdreich.">Jahresmittel-Temp. (°C)</label>
              <input 
                type="number" step="0.1"
                value={building.annualMeanTemp}
                onChange={(e) => setBuilding({...building, annualMeanTemp: Number(e.target.value)})}
                className="w-full bg-input-bg p-3 rounded-xl font-mono text-lg outline-none border border-transparent focus:border-border-main"
                title="Jahresmittel der Außentemperatur (theta_m,e): Wichtig für Verluste gegen Erdreich."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50" title="Wärmebrückenzuschlag (Delta U_WB): Pauschaler Zuschlag für Wärmebrücken nach DIN EN 12831. Standard: 0.05 W/(m²K) (Kategorie B).">Wärmebrückenzuschlag (ΔU WB)</label>
              <input 
                type="number" step="0.01"
                value={building.thermalBridgeAddition}
                onChange={(e) => setBuilding({...building, thermalBridgeAddition: Number(e.target.value)})}
                className="w-full bg-input-bg p-3 rounded-xl font-mono text-lg outline-none border border-transparent focus:border-border-main"
                title="Wärmebrückenzuschlag (Delta U_WB): Pauschaler Zuschlag für Wärmebrücken nach DIN EN 12831. Standard: 0.05 W/(m²K) (Kategorie B)."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50" title="Luftdichtheit (n_50): Luftwechselrate bei 50 Pa Druckdifferenz (Blower-Door-Test). Bereich: 0.5 (Passivhaus) bis 4.5 (Altbau).">Luftdichtheit (n50)</label>
              <input 
                type="number" step="0.1"
                value={building.airTightness}
                onChange={(e) => setBuilding({...building, airTightness: Number(e.target.value)})}
                className="w-full bg-input-bg p-3 rounded-xl font-mono text-lg outline-none border border-transparent focus:border-border-main"
                title="Luftdichtheit (n_50): Luftwechselrate bei 50 Pa Druckdifferenz (Blower-Door-Test). Bereich: 0.5 (Passivhaus) bis 4.5 (Altbau)."
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50">Abschirmklasse (Wind)</label>
              <select 
                value={building.shieldingClass}
                onChange={(e) => {
                  const val = e.target.value as any;
                  const factor = val === 'protected' ? 0.01 : val === 'moderate' ? 0.07 : 0.10;
                  setBuilding({...building, shieldingClass: val, shieldingFactor: factor});
                }}
                className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
              >
                <option value="protected">Geschützt (Stadtzentrum)</option>
                <option value="moderate">Moderat (Vorstadt)</option>
                <option value="exposed">Exponiert (Freies Feld)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50">Gebäudemasse</label>
              <select 
                value={building.buildingMass}
                onChange={(e) => setBuilding({...building, buildingMass: e.target.value as any})}
                className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main"
              >
                <option value="light">Leicht (Holzbau)</option>
                <option value="medium">Mittel (Ziegel/Beton)</option>
                <option value="heavy">Schwer (Massivbau)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50">Höhenfaktor (f)</label>
              <input 
                type="number" step="0.1"
                value={building.heightFactor}
                onChange={(e) => setBuilding({...building, heightFactor: Number(e.target.value)})}
                className="w-full bg-input-bg p-3 rounded-xl font-mono text-lg outline-none border border-transparent focus:border-border-main"
              />
            </div>

            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-50">Zusätzliche Beschreibung / Notizen</label>
              <textarea 
                value={building.description || ''}
                onChange={(e) => setBuilding({...building, description: e.target.value})}
                placeholder="z.B. Wohnung befindet sich in einem Mehrfamilienhaus, 2. OG..."
                className="w-full bg-input-bg p-3 rounded-xl font-sans text-sm outline-none border border-transparent focus:border-border-main min-h-[80px] resize-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button 
                onClick={() => setShowGlobalSettings(false)}
                className="flex-1 bg-accent text-accent-fg p-3 rounded-xl font-bold uppercase text-xs"
              >
                Schließen
              </button>
              <button 
                onClick={() => {
                  if (!resetConfirm) {
                    setResetConfirm(true);
                    setTimeout(() => setResetConfirm(false), 3000);
                    return;
                  }
                  localStorage.removeItem('heizlast_data');
                  setBuilding(DEFAULT_BUILDING_DATA);
                  setActiveRoomId(DEFAULT_BUILDING_DATA.rooms[0].id);
                  setShowGlobalSettings(false);
                  setResetConfirm(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-xs font-bold uppercase",
                  resetConfirm 
                    ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/20" 
                    : "border-red-500/30 text-red-500 hover:bg-red-500/10"
                )}
                title="Alle Daten zurücksetzen"
              >
                <RefreshCcw size={14} className={resetConfirm ? "animate-spin" : ""} />
                {resetConfirm ? "Sicher? (Nochmal klicken)" : "Daten zurücksetzen"}
              </button>
            </div>
          </div>
        )}

        {/* Sidebar: Room List */}
        <section className="md:col-span-4 lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[10px] font-bold uppercase opacity-50 tracking-widest">Räume</h2>
            <button onClick={handleAddRoom} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {building.rooms.map(room => (
              <div
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center group cursor-pointer",
                  activeRoomId === room.id 
                    ? "bg-accent border-accent text-accent-fg shadow-lg" 
                    : "bg-card-bg border-border-main/10 hover:border-border-main"
                )}
              >
                <div>
                  <p className="font-bold text-sm">{room.name}</p>
                  <p className={cn("text-[10px] font-mono opacity-50", activeRoomId === room.id && "text-white/60")}>
                    {results.rooms.find(r => r.id === room.id)?.totalLoad} W
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateRoom(room.id);
                    }}
                    className="p-1 hover:bg-accent hover:text-accent-fg rounded transition-colors"
                    title="Raum kopieren"
                  >
                    <Copy size={12} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (building.rooms.length > 1) {
                        const newRooms = building.rooms.filter(r => r.id !== room.id);
                        setBuilding({ ...building, rooms: newRooms });
                        if (activeRoomId === room.id) {
                          setActiveRoomId(newRooms[0].id);
                        }
                      } else {
                        alert("Mindestens ein Raum muss vorhanden sein.");
                      }
                    }}
                    className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                  <ChevronRight size={16} className={cn("opacity-0 group-hover:opacity-100 transition-opacity", activeRoomId === room.id && "opacity-100")} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Summary Card */}
          <div className="bg-card-bg border border-border-main p-6 rounded-2xl space-y-4">
            <span className="text-[10px] font-bold uppercase opacity-50">Gebäude Gesamt</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter">{(results.totalLoad / 1000).toFixed(2)}</span>
              <span className="text-lg font-medium opacity-50">kW</span>
            </div>
            <div className="pt-4 border-t border-border-main/10 space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold">
                <span className="opacity-50">Fläche</span>
                <span>{results.totalArea} m²</span>
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold">
                <span className="opacity-50">Spez. Last</span>
                <span>{results.specificLoad} W/m²</span>
              </div>
            </div>
          </div>
          {/* Loss Analysis Card */}
          <div className="bg-card-bg border border-border-main p-6 rounded-2xl space-y-4">
            <h3 className="text-[10px] font-bold uppercase opacity-50 tracking-widest flex items-center gap-2">
              <BarChart3 size={12} /> Verlust-Analyse
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={results.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="var(--bg-card)"
                    strokeWidth={2}
                  >
                    {results.distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      fontWeight: 'bold'
                    }}
                    itemStyle={{ color: 'var(--text-main)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {results.distribution.map((item, index) => (
                <div key={item.name} className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    <span className="opacity-50">{item.name}</span>
                  </div>
                  <span>{Math.round((item.value / results.totalLoad) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content: Room Details */}
        <section className="md:col-span-8 lg:col-span-9 space-y-6">
          {activeRoom ? (
            <div className="space-y-6">
              {/* Room Header & Basic Info */}
              <div className="bg-card-bg border border-border-main rounded-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-4">
                    <select 
                      value={activeRoom.type}
                      onChange={(e) => {
                        const type = e.target.value as RoomType;
                        const preset = ROOM_TYPES.find(t => t.id === type);
                        setBuilding({
                          ...building,
                          rooms: building.rooms.map(r => r.id === activeRoom.id ? { 
                            ...r, 
                            type,
                            targetTemp: preset?.temp || r.targetTemp,
                            airExchangeRate: preset?.nMin || r.airExchangeRate
                          } : r)
                        });
                      }}
                      className="bg-accent text-accent-fg px-3 py-1 rounded-lg text-[10px] font-bold uppercase outline-none"
                    >
                      {ROOM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <input 
                    type="text" 
                    value={activeRoom.name}
                    onChange={(e) => setBuilding({
                      ...building,
                      rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, name: e.target.value } : r)
                    })}
                    className="text-3xl font-bold tracking-tight outline-none bg-transparent border-b-2 border-transparent focus:border-border-main w-full"
                  />
                  <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Raum-ID: {activeRoom.id}</p>
                </div>
                <div className="flex flex-wrap gap-6 md:gap-8">
                  <div className="text-center" title="Norm-Innentemperatur (theta_int): Gewünschte Raumtemperatur nach DIN EN 12831. Standard: 20 °C (Wohnen), 24 °C (Bad).">
                    <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Ziel-Temp</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={activeRoom.targetTemp}
                        onChange={(e) => setBuilding({
                          ...building,
                          rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, targetTemp: Number(e.target.value) } : r)
                        })}
                        className="w-12 text-2xl font-bold font-mono outline-none bg-transparent text-right"
                        title="Norm-Innentemperatur (theta_int): Gewünschte Raumtemperatur nach DIN EN 12831. Standard: 20 °C (Wohnen), 24 °C (Bad)."
                      />
                      <span className="text-xl font-medium opacity-50">°C</span>
                    </div>
                  </div>
                  <div className="text-center" title="Raumfläche (A): Netto-Grundfläche des Raums in m².">
                    <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Fläche</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={activeRoom.area}
                        onChange={(e) => setBuilding({
                          ...building,
                          rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, area: Number(e.target.value) } : r)
                        })}
                        className="w-16 text-2xl font-bold font-mono outline-none bg-transparent text-right"
                        title="Raumfläche (A): Netto-Grundfläche des Raums in m²."
                      />
                      <span className="text-xl font-medium opacity-50">m²</span>
                    </div>
                  </div>
                  <div className="text-center" title="Aufheizfaktor (f_RH): Zuschlag für die Aufheizleistung nach Unterbrechung des Heizbetriebs. Bereich: 0 bis 20 W/m².">
                    <p className="text-[10px] font-bold uppercase opacity-50 mb-1">Aufheizf. (fRH)</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={activeRoom.reheatingFactor}
                        onChange={(e) => setBuilding({
                          ...building,
                          rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, reheatingFactor: Number(e.target.value) } : r)
                        })}
                        className="w-12 text-2xl font-bold font-mono outline-none bg-transparent text-right"
                        title="Aufheizfaktor (f_RH): Zuschlag für die Aufheizleistung nach Unterbrechung des Heizbetriebs. Bereich: 0 bis 20 W/m²."
                      />
                      <span className="text-xl font-medium opacity-50">W/m²</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plausibility Warnings */}
              {(() => {
                const activeRoomResult = results.rooms.find(r => r.id === activeRoom.id);
                const warnings = [];
                if (activeRoomResult) {
                  if (activeRoomResult.specificLoad > 150) warnings.push("Sehr hohe spezifische Heizlast (> 150 W/m²). Bitte Dämmung und Bauteile prüfen.");
                  if (activeRoomResult.specificLoad < 10 && activeRoomResult.specificLoad > 0) warnings.push("Sehr niedrige Heizlast (< 10 W/m²). Bitte Eingaben prüfen.");
                  
                  const hasWindow = activeRoom.components.some(c => c.type.includes('window'));
                  const hasExternalWall = activeRoom.components.some(c => c.type === 'wall' && c.adjacentTo === 'outside');
                  if (hasWindow && !hasExternalWall) warnings.push("Raum hat Fenster, aber keine Außenwand erfasst.");
                }
                
                if (warnings.length > 0) {
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                      {warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-3 text-amber-600 dark:text-amber-400 text-sm font-medium">
                          <AlertTriangle size={16} className="shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Components Section */}
              <div className="bg-card-bg border border-border-main rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border-main bg-accent text-accent-fg flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Layers size={18} />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Umschließungsflächen (Bauteile)</h3>
                  </div>
                  <button 
                    onClick={() => handleAddComponent(activeRoom.id)}
                    className="flex items-center gap-2 bg-card-bg text-main-text px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-card-bg/90 transition-all"
                  >
                    <Plus size={14} /> Bauteil hinzufügen
                  </button>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-main/10 bg-input-bg">
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40" title="Art des Bauteils (z.B. Außenwand, Fenster) und individuelle Bezeichnung.">Typ / Name</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40" title="Himmelsrichtung, in die das Bauteil zeigt. Wichtig für solare Gewinne (hier nur informativ).">Orient.</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40" title="Gibt an, woran das Bauteil grenzt (Außenluft, Erdreich, unbeheizter Raum). Bestimmt den Korrekturfaktor fx.">Angrenzend</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40" title="Temperatur-Korrekturfaktor (f_x): Faktor zur Berücksichtigung reduzierter Temperaturdifferenzen bei angrenzenden Räumen oder Erdreich.">Korr. (fx)</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40 text-right" title="Breite x Höhe des Bauteils in Metern.">B x H (m)</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40 text-right" title="Netto-Fläche des Bauteils in m².">Fläche (m²)</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40 text-right" title="Wärmedurchgangskoeffizient (U): Maß für den Wärmedurchgang durch ein Bauteil. Bereich: 0.1 bis 3.0 W/(m²K).">U-Wert</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40 text-right" title="Bauteilspezifischer Wärmebrückenzuschlag (Delta U_WB). Überschreibt den globalen Wert.">ΔU WB</th>
                        <th className="px-2 py-3 text-[10px] font-bold uppercase opacity-40 text-right" title="Transmissionswärmeverlust des Bauteils in Watt (W).">Verlust (W)</th>
                        <th className="px-2 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/10">
                      {activeRoom.components.map(comp => (
                        <tr key={comp.id} className="hover:bg-black/5 transition-colors group border-b border-border-main/5">
                          <td className="px-2 py-3">
                            <div className="flex flex-col gap-1 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const Icon = COMPONENT_TYPES.find(t => t.id === comp.type)?.icon || Layers;
                                  return <Icon size={14} className="opacity-40 shrink-0" />;
                                })()}
                                <select 
                                  value={comp.type}
                                  onChange={(e) => {
                                    const newType = e.target.value as any;
                                    setBuilding({
                                      ...building,
                                      rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                        ...r,
                                        components: r.components.map(c => c.id === comp.id ? { 
                                          ...c, 
                                          type: newType,
                                          uValue: DEFAULT_U_VALUES[newType] || c.uValue
                                        } : c)
                                      } : r)
                                    });
                                  }}
                                  className="bg-transparent font-bold text-xs outline-none cursor-pointer flex-1"
                                  title="Wählen Sie den Bauteiltyp aus. Dies setzt automatisch einen Standard-U-Wert."
                                >
                                  {COMPONENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                              </div>
                              <input 
                                type="text"
                                value={comp.name}
                                onChange={(e) => setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { ...c, name: e.target.value } : c)
                                  } : r)
                                })}
                                className="bg-transparent text-[10px] outline-none border-b border-transparent focus:border-border-main opacity-50 ml-[22px]"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <select 
                              value={comp.orientation}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, orientation: e.target.value as any } : c)
                                } : r)
                              })}
                              className="bg-transparent font-mono text-[10px] outline-none cursor-pointer"
                              title="Himmelsrichtung des Bauteils."
                            >
                              {ORIENTATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-3">
                            <select 
                              value={comp.adjacentTo}
                              onChange={(e) => {
                                const adj = e.target.value as any;
                                const factor = ADJACENT_TYPES.find(t => t.id === adj)?.factor || 1.0;
                                setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { ...c, adjacentTo: adj, correctionFactor: factor } : c)
                                  } : r)
                                });
                              }}
                              className="bg-transparent font-mono text-[10px] outline-none cursor-pointer max-w-[80px]"
                              title="Bestimmt die Temperaturdifferenz auf der anderen Seite des Bauteils."
                            >
                              {ADJACENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-3">
                            <input 
                              type="number" step="0.1"
                              value={comp.correctionFactor}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, correctionFactor: Number(e.target.value) } : c)
                                } : r)
                              })}
                              className="w-8 bg-transparent font-mono text-[10px] outline-none border-b border-transparent focus:border-border-main"
                              title="Korrekturfaktor f_x"
                            />
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 min-w-[60px]">
                              <input 
                                type="number" step="0.1"
                                value={comp.width}
                                onChange={(e) => {
                                  const w = Number(e.target.value);
                                  setBuilding({
                                    ...building,
                                    rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                      ...r,
                                      components: r.components.map(c => c.id === comp.id ? { ...c, width: w, area: Math.round(w * c.height * 100) / 100 } : c)
                                    } : r)
                                  });
                                }}
                                className="w-8 bg-transparent font-mono text-xs text-right outline-none"
                              />
                              <span className="opacity-30">x</span>
                              <input 
                                type="number" step="0.1"
                                value={comp.height}
                                onChange={(e) => {
                                  const h = Number(e.target.value);
                                  setBuilding({
                                    ...building,
                                    rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                      ...r,
                                      components: r.components.map(c => c.id === comp.id ? { ...c, height: h, area: Math.round(c.width * h * 100) / 100 } : c)
                                    } : r)
                                  });
                                }}
                                className="w-8 bg-transparent font-mono text-xs text-right outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <input 
                              type="number" step="0.1"
                              value={comp.area}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, area: Number(e.target.value) } : c)
                                } : r)
                              })}
                              className="w-12 bg-transparent font-mono text-xs text-right outline-none border-b border-transparent focus:border-border-main"
                              title="Netto-Fläche des Bauteils in m². Wird automatisch berechnet, wenn Breite/Höhe geändert werden."
                            />
                          </td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <input 
                                type="number" step="0.01"
                                value={comp.uValue}
                                onChange={(e) => setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { ...c, uValue: Number(e.target.value) } : c)
                                  } : r)
                                })}
                                className="w-12 bg-transparent font-mono text-xs text-right outline-none border-b border-transparent focus:border-border-main"
                                title="Wärmedurchgangskoeffizient (U): Maß für den Wärmedurchgang durch ein Bauteil. Bereich: 0.1 bis 3.0 W/(m²K)."
                              />
                              <select
                                className="w-16 bg-input-bg text-[8px] rounded outline-none opacity-50 hover:opacity-100 cursor-pointer p-0.5"
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if(val) {
                                    setBuilding({
                                      ...building,
                                      rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                        ...r,
                                        components: r.components.map(c => c.id === comp.id ? { ...c, uValue: val } : c)
                                      } : r)
                                    });
                                  }
                                  e.target.value = ""; // Reset after selection
                                }}
                                value=""
                                title="Typische U-Werte nach Baujahr"
                              >
                                <option value="">Katalog...</option>
                                {U_VALUE_CATALOG.map(u => <option key={u.label} value={u.value}>{u.label} ({u.value.toFixed(2)})</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <input 
                              type="number" step="0.01"
                              value={comp.thermalBridgeFactor ?? ''}
                              placeholder={building.thermalBridgeAddition.toString()}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, thermalBridgeFactor: e.target.value === '' ? undefined : Number(e.target.value) } : c)
                                } : r)
                              })}
                              className="w-10 bg-transparent font-mono text-xs text-right outline-none border-b border-transparent focus:border-border-main placeholder:opacity-30"
                              title="Bauteilspezifischer Wärmebrückenzuschlag (leer lassen für Standardwert)"
                            />
                          </td>
                          <td className="px-2 py-3 text-right font-mono font-bold text-xs">
                            {Math.round(results.rooms.find(r => r.id === activeRoom.id)?.components.find(c => c.id === comp.id)?.loss || 0)}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button 
                              onClick={() => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.filter(c => c.id !== comp.id)
                                } : r)
                              })}
                              className="p-1 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border-main/10">
                  {activeRoom.components.map(comp => (
                    <div key={comp.id} className="p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {(() => {
                              const Icon = COMPONENT_TYPES.find(t => t.id === comp.type)?.icon || Layers;
                              return <Icon size={16} className="opacity-40 shrink-0" />;
                            })()}
                            <select 
                              value={comp.type}
                              onChange={(e) => {
                                const newType = e.target.value as any;
                                setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { 
                                      ...c, 
                                      type: newType,
                                      uValue: DEFAULT_U_VALUES[newType] || c.uValue
                                    } : c)
                                  } : r)
                                });
                              }}
                              className="bg-transparent font-bold text-sm outline-none cursor-pointer flex-1"
                              title="Art des Bauteils (z.B. Außenwand, Fenster). Setzt automatisch einen Standard-U-Wert."
                            >
                              {COMPONENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>
                          <input 
                            type="text"
                            value={comp.name}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                ...r,
                                components: r.components.map(c => c.id === comp.id ? { ...c, name: e.target.value } : c)
                              } : r)
                            })}
                            className="bg-transparent text-xs outline-none border-b border-transparent focus:border-border-main opacity-50 w-full ml-[24px]"
                            placeholder="Bauteil Name"
                          />
                        </div>
                        <button 
                          onClick={() => setBuilding({
                            ...building,
                            rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                              ...r,
                              components: r.components.filter(c => c.id !== comp.id)
                            } : r)
                          })}
                          className="p-2 text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-40 mb-1">Orient. / Angrenzend</p>
                          <div className="flex gap-2">
                            <select 
                              value={comp.orientation}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, orientation: e.target.value as any } : c)
                                } : r)
                              })}
                              className="bg-input-bg px-2 py-1 rounded border border-border-main/10 text-xs outline-none"
                              title="Himmelsrichtung des Bauteils."
                            >
                              {ORIENTATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <select 
                              value={comp.adjacentTo}
                              onChange={(e) => {
                                const adj = e.target.value as any;
                                const factor = ADJACENT_TYPES.find(t => t.id === adj)?.factor || 1.0;
                                setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { ...c, adjacentTo: adj, correctionFactor: factor } : c)
                                  } : r)
                                });
                              }}
                              className="bg-input-bg px-2 py-1 rounded border border-border-main/10 text-[10px] outline-none flex-1"
                              title="Gibt an, woran das Bauteil grenzt (Außenluft, Erdreich, unbeheizter Raum)."
                            >
                              {ADJACENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-40 mb-1" title="Temperatur-Korrekturfaktor (f_x): Faktor zur Berücksichtigung reduzierter Temperaturdifferenzen bei angrenzenden Räumen oder Erdreich.">Korr. (fx)</p>
                          <input 
                            type="number" step="0.1"
                            value={comp.correctionFactor}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, correctionFactor: Number(e.target.value) } : c)
                                } : r)
                              })}
                              className="w-full bg-input-bg px-2 py-1 rounded border border-border-main/10 text-xs outline-none"
                              title="Temperatur-Korrekturfaktor (f_x): Faktor zur Berücksichtigung reduzierter Temperaturdifferenzen bei angrenzenden Räumen oder Erdreich."
                            />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-40 mb-1">Maße (B x H)</p>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" step="0.1"
                              value={comp.width}
                              onChange={(e) => {
                                const w = Number(e.target.value);
                                setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { 
                                      ...c, 
                                      width: w, 
                                      area: Math.round(w * c.height * 100) / 100 
                                    } : c)
                                  } : r)
                                });
                              }}
                              className="w-full bg-input-bg px-1 py-1 rounded border border-border-main/10 text-xs text-center outline-none"
                            />
                            <span className="opacity-30">x</span>
                            <input 
                              type="number" step="0.1"
                              value={comp.height}
                              onChange={(e) => {
                                const h = Number(e.target.value);
                                setBuilding({
                                  ...building,
                                  rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                    ...r,
                                    components: r.components.map(c => c.id === comp.id ? { 
                                      ...c, 
                                      height: h, 
                                      area: Math.round(c.width * h * 100) / 100 
                                    } : c)
                                  } : r)
                                });
                              }}
                              className="w-full bg-input-bg px-1 py-1 rounded border border-border-main/10 text-xs text-center outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-40 mb-1" title="Netto-Fläche des Bauteils in m². Wird automatisch berechnet, wenn Breite/Höhe geändert werden.">Fläche (m²)</p>
                          <input 
                            type="number" step="0.1"
                            value={comp.area}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                ...r,
                                components: r.components.map(c => c.id === comp.id ? { ...c, area: Number(e.target.value) } : c)
                              } : r)
                            })}
                            className="w-full bg-input-bg px-2 py-1 rounded border border-border-main/10 text-xs outline-none"
                            title="Netto-Fläche des Bauteils in m²."
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase opacity-40 mb-1" title="Wärmedurchgangskoeffizient (U): Maß für den Wärmedurchgang durch ein Bauteil. Bereich: 0.1 bis 3.0 W/(m²K).">U-Wert</p>
                          <input 
                            type="number" step="0.01"
                            value={comp.uValue}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                ...r,
                                components: r.components.map(c => c.id === comp.id ? { ...c, uValue: Number(e.target.value) } : c)
                              } : r)
                            })}
                            className="w-full bg-input-bg px-2 py-1 rounded border border-border-main/10 text-xs outline-none"
                            title="Wärmedurchgangskoeffizient (U): Maß für den Wärmedurchgang durch ein Bauteil. Bereich: 0.1 bis 3.0 W/(m²K)."
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-accent/5 p-2 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[8px] font-bold uppercase opacity-40" title="Bauteilspezifischer Wärmebrückenzuschlag (Delta U_WB). Überschreibt den globalen Wert.">ΔU WB</p>
                            <input 
                              type="number" step="0.01"
                              value={comp.thermalBridgeFactor ?? ''}
                              placeholder={building.thermalBridgeAddition.toString()}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? {
                                  ...r,
                                  components: r.components.map(c => c.id === comp.id ? { ...c, thermalBridgeFactor: e.target.value === '' ? undefined : Number(e.target.value) } : c)
                                } : r)
                              })}
                              className="w-12 bg-transparent font-mono text-xs outline-none border-b border-transparent focus:border-border-main placeholder:opacity-30"
                              title="Bauteilspezifischer Wärmebrückenzuschlag (Delta U_WB). Überschreibt den globalen Wert."
                            />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold uppercase opacity-40">Verlust</p>
                            <p className="font-mono font-bold text-sm">
                              {Math.round(results.rooms.find(r => r.id === activeRoom.id)?.components.find(c => c.id === comp.id)?.loss || 0)} W
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeRoom.components.length === 0 && (
                    <div className="p-8 text-center opacity-30 text-xs uppercase tracking-widest">
                      Keine Bauteile vorhanden
                    </div>
                  )}
                </div>
              </div>

              {/* Room Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card-bg border border-border-main p-8 rounded-2xl space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Wind size={16} /> Lüftung & Aufheizung
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1" title="Art der Lüftung nach DIN EN 12831. Bestimmt, wie der Lüftungswärmeverlust berechnet wird.">
                        <label className="text-[10px] font-bold uppercase opacity-50">Lüftungstyp</label>
                        <select 
                          value={activeRoom.ventilationType}
                          onChange={(e) => setBuilding({
                            ...building,
                            rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, ventilationType: e.target.value as any } : r)
                          })}
                          className="w-full bg-input-bg p-2 rounded-lg text-xs font-bold outline-none border border-transparent focus:border-border-main"
                          title="Art der Lüftung nach DIN EN 12831. Bestimmt, wie der Lüftungswärmeverlust berechnet wird."
                        >
                          <option value="natural">Natürliche Lüftung</option>
                          <option value="mechanical">Mechanisch</option>
                          <option value="mechanical_recovery">Mechanisch mit WRG</option>
                        </select>
                      </div>
                      <div className="space-y-1" title="Aufheizfaktor (f_RH): Zuschlag für die Aufheizleistung nach Unterbrechung des Heizbetriebs. Bereich: 0 bis 20 W/m².">
                        <label className="text-[10px] font-bold uppercase opacity-50">Aufheizfaktor (f_RH)</label>
                        <div className="flex items-center gap-2 bg-input-bg p-2 rounded-lg border border-transparent focus-within:border-border-main">
                          <input 
                            type="number" step="1"
                            value={activeRoom.reheatingFactor}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, reheatingFactor: Number(e.target.value) } : r)
                            })}
                            className="w-full bg-transparent text-xs font-mono font-bold text-right outline-none"
                            title="Aufheizfaktor (f_RH): Zuschlag für die Aufheizleistung nach Unterbrechung des Heizbetriebs. Bereich: 0 bis 20 W/m²."
                          />
                          <span className="text-[10px] opacity-40 whitespace-nowrap">W/m²</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1" title="Mindestluftwechselrate (n_min): Erforderlicher Luftwechsel zur Sicherstellung der Hygiene. Standard: 0.5 h⁻¹.">
                        <label className="text-[10px] font-bold uppercase opacity-50">Mindestluftwechsel (n_min)</label>
                        <div className="flex items-center gap-2 bg-input-bg p-2 rounded-lg border border-transparent focus-within:border-border-main">
                          <input 
                            type="number" step="0.1"
                            value={activeRoom.airExchangeRate}
                            onChange={(e) => setBuilding({
                              ...building,
                              rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, airExchangeRate: Number(e.target.value) } : r)
                            })}
                            className="w-full bg-transparent text-xs font-mono font-bold text-right outline-none"
                            title="Mindestluftwechselrate (n_min): Erforderlicher Luftwechsel zur Sicherstellung der Hygiene. Standard: 0.5 h⁻¹."
                          />
                          <span className="text-[10px] opacity-40 whitespace-nowrap">1/h</span>
                        </div>
                      </div>
                      {activeRoom.ventilationType === 'mechanical_recovery' && (
                        <div className="space-y-1" title="Wärmebereitstellungsgrad (eta_WRG): Wirkungsgrad der Wärmerückgewinnung der Lüftungsanlage. Bereich: 0.0 bis 1.0 (z.B. 0.85 für 85%).">
                          <label className="text-[10px] font-bold uppercase opacity-50">Wärmebereitstellungsgrad (η)</label>
                          <div className="flex items-center gap-2 bg-input-bg p-2 rounded-lg border border-transparent focus-within:border-border-main">
                            <input 
                              type="number" step="0.01" min="0" max="1"
                              value={activeRoom.heatRecoveryEfficiency}
                              onChange={(e) => setBuilding({
                                ...building,
                                rooms: building.rooms.map(r => r.id === activeRoom.id ? { ...r, heatRecoveryEfficiency: Number(e.target.value) } : r)
                              })}
                              className="w-full bg-transparent text-xs font-mono font-bold text-right outline-none"
                              title="Wärmebereitstellungsgrad (eta_WRG): Wirkungsgrad der Wärmerückgewinnung der Lüftungsanlage. Bereich: 0.0 bis 1.0 (z.B. 0.85 für 85%)."
                            />
                            <span className="text-[10px] opacity-40 whitespace-nowrap">%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border-main/10 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase opacity-50">Ergebnis Lüftung + Aufh.</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono text-accent">
                          {(results.rooms.find(r => r.id === activeRoom.id)?.ventilationLoss || 0) + (results.rooms.find(r => r.id === activeRoom.id)?.reheatingLoad || 0)}
                        </span>
                        <span className="text-xs opacity-50">W</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-accent text-accent-fg p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs font-bold uppercase tracking-wider">Gesamtheizlast Raum</h3>
                      <FileText size={20} className="opacity-50" />
                    </div>
                    <div className="mt-8">
                      <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-bold tracking-tighter">
                          {results.rooms.find(r => r.id === activeRoom.id)?.totalLoad}
                        </span>
                        <span className="text-2xl font-medium opacity-50">W</span>
                      </div>
                      <p className="text-xs opacity-50 mt-2 font-mono uppercase tracking-widest">
                        Spezifisch: {results.rooms.find(r => r.id === activeRoom.id)?.specificLoad} W/m² | Aufheizf. (fRH): {activeRoom.reheatingFactor} W/m²
                      </p>
                    </div>
                  </div>
                  
                  {/* Mini Chart for Room Distribution */}
                  <div className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-40">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Transmission', value: results.rooms.find(r => r.id === activeRoom.id)?.transmissionLoss || 0 },
                            { name: 'Lüftung', value: results.rooms.find(r => r.id === activeRoom.id)?.ventilationLoss || 0 },
                            { name: 'Aufheizung', value: results.rooms.find(r => r.id === activeRoom.id)?.reheatingLoad || 0 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="var(--bg-card)"
                          strokeWidth={2}
                        >
                          {results.distribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-card-bg/30 border-2 border-dashed border-border-main/10 rounded-3xl p-12 text-center">
              <div className="bg-accent/5 p-6 rounded-full mb-6">
                <Home size={48} className="opacity-20" />
              </div>
              <h3 className="text-xl font-bold mb-2">Kein Raum ausgewählt</h3>
              <p className="text-sm opacity-50 max-w-xs mx-auto mb-8">
                Wählen Sie einen Raum aus der Liste aus oder erstellen Sie einen neuen, um mit der normgerechten Heizlastberechnung zu beginnen.
              </p>
              <button 
                onClick={handleAddRoom}
                className="bg-accent text-accent-fg px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:scale-105 transition-all"
              >
                Ersten Raum anlegen
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Climate Selector Modal */}
      {showClimateSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-border-main w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-border-main flex justify-between items-center bg-accent/5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Cloud size={24} className="text-accent" /> Klimadaten Deutschland
                </h2>
                <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Lokale Datenbank für Norm-Außentemperaturen</p>
              </div>
              <button onClick={() => setShowClimateSelector(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 border-b border-border-main">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                <input 
                  type="text"
                  placeholder="Stadt oder PLZ suchen..."
                  value={climateSearch}
                  onChange={(e) => setClimateSearch(e.target.value)}
                  className="w-full bg-input-bg pl-12 pr-4 py-4 rounded-2xl outline-none border border-transparent focus:border-accent transition-all font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-1 gap-1">
                {CLIMATE_DATA.filter(d => 
                  d.city.toLowerCase().includes(climateSearch.toLowerCase()) || 
                  d.plz.includes(climateSearch)
                ).map((data) => (
                  <button
                    key={`${data.city}-${data.plz}`}
                    onClick={() => {
                      setBuilding({
                        ...building,
                        outdoorTemp: data.outdoorTemp,
                        annualMeanTemp: data.annualMeanTemp,
                        projectInfo: {
                          ...building.projectInfo,
                          location: `${data.plz} ${data.city}`
                        }
                      });
                      setShowClimateSelector(false);
                      setClimateSearch('');
                    }}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-accent hover:text-accent-fg transition-all group text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{data.city}</span>
                        <span className="bg-black/5 group-hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">{data.plz}</span>
                      </div>
                      <span className="text-[10px] uppercase opacity-50 font-bold group-hover:text-accent-fg/70 tracking-widest">Deutschland</span>
                    </div>
                    <div className="flex gap-8 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-bold opacity-50 block group-hover:text-accent-fg/70">Norm-Temp.</span>
                        <span className="font-mono font-bold">{data.outdoorTemp} °C</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold opacity-50 block group-hover:text-accent-fg/70">Jahresmittel</span>
                        <span className="font-mono font-bold">{data.annualMeanTemp} °C</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-black/5 text-center">
              <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                Daten basieren auf DIN EN 12831-1 Klimatabellen
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-[1440px] mx-auto p-6 border-t border-border-main mt-12 flex flex-col md:flex-row justify-between items-center gap-4 opacity-50">
        <p className="text-[10px] uppercase font-bold tracking-widest">© 2026 Heizlast-Profi • DIN EN 12831 Compliance Tool</p>
        <div className="flex gap-6 text-[10px] uppercase font-bold tracking-widest">
          <button 
            onClick={() => setShowClimateSelector(true)} 
            className="hover:underline uppercase font-bold tracking-widest"
          >
            Klimadaten (Lokal)
          </button>
          <button 
            onClick={() => setShowRadiatorCalculator(true)} 
            className="hover:underline uppercase font-bold tracking-widest"
          >
            Heizkörper Rechner
          </button>
          <button 
            onClick={() => setShowUValueCalculator(true)} 
            className="hover:underline uppercase font-bold tracking-widest"
          >
            U-Wert Rechner
          </button>
        </div>
      </footer>
    </div>
  );
}

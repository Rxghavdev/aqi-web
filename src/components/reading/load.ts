import { cache } from "react";
import { getCity, getStation, getStationPage } from "@/lib/report";

export const loadCity = cache(getCity);
export const loadStation = cache(getStation);
export const loadStationPage = cache(getStationPage);

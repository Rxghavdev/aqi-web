import { cache } from "react";
import { getCity, getStation } from "@/lib/report";

export const loadCity = cache(getCity);
export const loadStation = cache(getStation);

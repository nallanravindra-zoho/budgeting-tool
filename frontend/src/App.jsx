import React, { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell, LabelList, ComposedChart, ReferenceLine } from "recharts";
import { Send, Check, X, Save, Clock, TrendingUp, TrendingDown, ChevronDown, ChevronRight, ChevronLeft, Search, Loader2, Terminal, RotateCcw, Sparkles, Sliders, Grid3x3, Wand2, RefreshCw, Minus, Maximize2, Minimize2, LayoutDashboard, Building2, Globe, Receipt, Users, Wallet, PieChart as PieChartIcon, BarChart3, History, ClipboardList, Info, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { getVendors, quickEditVendorBudget, applyVendorPlan as applyVendorPlanFn, getRegions, listSavedVersions, saveVersion as saveVersionFn, loadVersion as loadVersionFn, getActiveBudgetingYear, getAvailableYears, getActualCutoffMonthIndex, addVendor as addVendorFn, removeVendor as removeVendorFn, getVendorHistory, generateFutureBudgets, getMyAccessProfile } from "./firestoreData.js";
import { getExpenseCategories, addExpenseCategory, removeExpenseCategory, getUnmappedAccounts, setGlAccountMapping, getCategoryRollup, getExpenseAgreements, addExpenseAgreement, updateExpenseAgreement, removeExpenseAgreement, getGrowthAssumptions, setGrowthAssumption, generateOtherExpensesBudget, getOtherExpensesBudget, overrideOtherExpensesBudgetLine } from "./otherExpensesData.js";
import { isYearCompleted, classifyYear, YEAR_CLASSIFICATION_LABELS, computeFySystemForecast, computeVendorStatus, STATUS_LABELS, STATUS_COLORS, getManagementForecasts, setManagementForecast, getRegionPerformanceData } from "./vendorPerformance.js";
import { getEmployees, addEmployee, updateEmployee, resignEmployee, reinstateEmployee, deleteEmployee, setEmployeeHikes, getBenefitThresholds, setBenefitThresholds, computeEmployeeMonthlyCost, computeBenefitEligibility, computeEmployeeDashboardStats } from "./employeeData.js";
import { getAssumptions, addAssumption, updateAssumption, removeAssumption, DEFAULT_ASSUMPTIONS } from "./assumptions.js";
import { getInvoicesByYearRange, computeOperationalStats } from "./operationalStats.js";
import { getCashFlowRawData, computeCashFlow, AGED_THRESHOLD_DAYS } from "./cashFlowData.js";
import { callChat, syncCiprNow, syncOtherExpensesLedgerNow, syncBillsNow } from "./chatClient.js";
import { signOutUser, auth } from "./firebase.js";

/* ============================= EMBEDDED SEED DATA ============================= */
const SEED_VENDORS = [{"vendor":"Crowdstrike","owner":"Geetha","gp_pct":0.065,"budget_revenue":37500000,"budget_gp":2437500.0,"monthly_budget_revenue":[1345791.7,1345791.7,2691583.4,2205856.98,2205856.98,4411713.96,2343750,2343750,4687500,3562500,3562500,6793405.29],"ytd_budget_revenue":18894094.72,"actual_revenue_ytd":27340247.47,"actual_gp_ytd":1963248.99,"monthly_actual_revenue":[4476041.67,602847.79,2773364.64,4622874.52,2313298.97,7227383.49,5239089.93,85346.46,0,0,0,0]},{"vendor":"Group IB","owner":"Sheyyab","gp_pct":0.075,"budget_revenue":22500000,"budget_gp":1687500.0,"monthly_budget_revenue":[807475.02,807475.02,1614950.04,1323514.19,1323514.19,2647028.37,1406250,1406250,2812500,2137500,2137500,4076043.17],"ytd_budget_revenue":11336456.83,"actual_revenue_ytd":9686908.33,"actual_gp_ytd":894311.2,"monthly_actual_revenue":[2501841.95,1187126.93,894875.96,261033.21,1922284.67,1204435.74,1023620.74,691689.13,0,0,0,0]},{"vendor":"Proofpoint","owner":"Ribha","gp_pct":0.07,"budget_revenue":15000000.0,"budget_gp":1050000.0,"monthly_budget_revenue":[538316.68,538316.68,1076633.36,882342.79,882342.79,1764685.58,937500,937500,1875000,1425000,1425000,2717362.12],"ytd_budget_revenue":7557637.88,"actual_revenue_ytd":7143647.2,"actual_gp_ytd":594835.0,"monthly_actual_revenue":[1585816.0,812279.93,1728683.19,652634.18,488931.07,1087898.5,753914.33,33490.0,0,0,0,0]},{"vendor":"Elastic","owner":"Anas","gp_pct":0.125,"budget_revenue":12000000.0,"budget_gp":1500000.0,"monthly_budget_revenue":[430653.34,430653.34,861306.69,705874.23,705874.23,1411748.47,750000,750000,1500000,1140000,1140000,2173889.69],"ytd_budget_revenue":6046110.3,"actual_revenue_ytd":8795655.11,"actual_gp_ytd":1091821.51,"monthly_actual_revenue":[947547.46,1638530.44,717502.46,1524000.65,1063047.27,494366.81,2344038.44,66621.58,0,0,0,0]},{"vendor":"Arista","owner":"Alezzeh","gp_pct":0.09,"budget_revenue":11500000,"budget_gp":1035000.0,"monthly_budget_revenue":[412709.45,412709.45,825418.91,676462.81,676462.81,1352925.61,718750,718750,1437500,1092500,1092500,2083310.96],"ytd_budget_revenue":5794189.04,"actual_revenue_ytd":11584957.35,"actual_gp_ytd":994324.57,"monthly_actual_revenue":[34780.83,699613.72,6033810.78,349773.44,1128465.46,2808073.86,485882.26,44557.0,0,0,0,0]},{"vendor":"Solarwinds","owner":"Faiz","gp_pct":0.135,"budget_revenue":10500000,"budget_gp":1417500.0,"monthly_budget_revenue":[376821.68,376821.68,753643.35,617639.95,617639.95,1235279.91,656250,656250,1312500,997500,997500,1902153.48],"ytd_budget_revenue":5290346.52,"actual_revenue_ytd":5583208.75,"actual_gp_ytd":845652.6,"monthly_actual_revenue":[235358.81,1003323.16,584873.98,1326705.86,731064.92,1412539.08,233609.24,55733.7,0,0,0,0]},{"vendor":"Forescout","owner":"Alezzeh","gp_pct":0.115,"budget_revenue":9000000,"budget_gp":1035000.0,"monthly_budget_revenue":[322990.01,322990.01,645980.02,529405.67,529405.67,1058811.35,562500,562500,1125000,855000,855000,1630417.27],"ytd_budget_revenue":4534582.73,"actual_revenue_ytd":1146159.43,"actual_gp_ytd":91429.83,"monthly_actual_revenue":[135904.49,37029.74,304083.39,0,311741.91,259995.41,97404.49,0,0,0,0,0]},{"vendor":"Fortra","owner":"Saif","gp_pct":0.17,"budget_revenue":8250000.0,"budget_gp":1402500.0,"monthly_budget_revenue":[296074.17,296074.17,592148.35,485288.54,485288.54,970577.07,515625,515625,1031250,783750,783750,1494549.16],"ytd_budget_revenue":4156700.84,"actual_revenue_ytd":3978140.2,"actual_gp_ytd":767176.63,"monthly_actual_revenue":[74403.21,105215.0,928888.04,146257.89,592621.25,1481130.38,631166.44,18458.0,0,0,0,0]},{"vendor":"Netskope","owner":"Samreen","gp_pct":0.075,"budget_revenue":7000000,"budget_gp":525000.0,"monthly_budget_revenue":[251214.45,251214.45,502428.9,411759.97,411759.97,823519.94,437500,437500,875000,665000,665000,1268102.32],"ytd_budget_revenue":3526897.68,"actual_revenue_ytd":6232530.29,"actual_gp_ytd":528018.4,"monthly_actual_revenue":[219415.73,61600.0,1661787.05,1173905.61,1048558.15,356121.13,1659738.94,51403.68,0,0,0,0]},{"vendor":"Checkmarx","owner":"Sheyyab","gp_pct":0.07,"budget_revenue":6750000.0,"budget_gp":472500.0,"monthly_budget_revenue":[242242.51,242242.51,484485.01,397054.26,397054.26,794108.51,421875,421875,843750,641250,641250,1222812.95],"ytd_budget_revenue":3400937.06,"actual_revenue_ytd":3512803.87,"actual_gp_ytd":233641.76,"monthly_actual_revenue":[40870.0,219500.31,689728.78,376233.0,1574738.78,611733.0,0,0,0,0,0,0]},{"vendor":"Entrust","owner":"Sheyyab","gp_pct":0.135,"budget_revenue":6250000,"budget_gp":843750.0,"monthly_budget_revenue":[224298.62,224298.62,448597.23,367642.83,367642.83,735285.66,390625,390625,781250,593750,593750,1132234.22],"ytd_budget_revenue":3149015.79,"actual_revenue_ytd":5312062.32,"actual_gp_ytd":573795.33,"monthly_actual_revenue":[971005.0,740494.75,1336915.89,1212389.31,233231.39,510923.64,307102.34,0,0,0,0,0]},{"vendor":"Exagrid","owner":"Faiz","gp_pct":0.07,"budget_revenue":4500000,"budget_gp":315000.0,"monthly_budget_revenue":[161495.0,161495.0,322990.01,264702.84,264702.84,529405.67,281250,281250,562500,427500,427500,815208.63],"ytd_budget_revenue":2267291.36,"actual_revenue_ytd":2903184.16,"actual_gp_ytd":409994.94,"monthly_actual_revenue":[519473.9,66282.0,291368.0,267135.01,127048.68,792081.88,839794.69,0,0,0,0,0]},{"vendor":"Immersive Labs","owner":"Anas","gp_pct":0.06,"budget_revenue":4000000.0,"budget_gp":240000.0,"monthly_budget_revenue":[143551.11,143551.11,287102.23,235291.41,235291.41,470582.82,250000,250000,500000,380000,380000,724629.9],"ytd_budget_revenue":2015370.09,"actual_revenue_ytd":1518005.93,"actual_gp_ytd":108860.92,"monthly_actual_revenue":[51200.0,290602.87,192123.46,148740.73,471400.0,21877.8,342061.07,0,0,0,0,0]},{"vendor":"Netwrix","owner":"Samreen","gp_pct":0.22,"budget_revenue":3500000,"budget_gp":770000.0,"monthly_budget_revenue":[125607.23,125607.23,251214.45,205879.98,205879.98,411759.97,218750,218750,437500,332500,332500,634051.16],"ytd_budget_revenue":1763448.84,"actual_revenue_ytd":1946297.07,"actual_gp_ytd":309432.67,"monthly_actual_revenue":[54539.28,146649.0,222622.65,307355.78,367004.64,108891.12,574323.6,164911.0,0,0,0,0]},{"vendor":"Xage","owner":"Sheyyab","gp_pct":0.09,"budget_revenue":3500000,"budget_gp":315000.0,"monthly_budget_revenue":[125607.23,125607.23,251214.45,205879.98,205879.98,411759.97,218750,218750,437500,332500,332500,634051.16],"ytd_budget_revenue":1763448.84,"actual_revenue_ytd":2087932.4,"actual_gp_ytd":50329.3,"monthly_actual_revenue":[143500.0,150000.0,138764.46,690157.91,244284.93,684671.82,36553.28,0,0,0,0,0]},{"vendor":"Netwitness","owner":"Tarek","gp_pct":0.08,"budget_revenue":2500000,"budget_gp":200000.0,"monthly_budget_revenue":[89719.45,89719.45,179438.89,147057.13,147057.13,294114.26,156250,156250,312500,237500,237500,452893.69],"ytd_budget_revenue":1259606.31,"actual_revenue_ytd":1183485.85,"actual_gp_ytd":211140.05,"monthly_actual_revenue":[83415.0,20000.0,313530.85,0,189771.49,576768.51,0,0,0,0,0,0]},{"vendor":"Phosphorus","owner":"Amr Elsayed","gp_pct":0.1,"budget_revenue":2500000,"budget_gp":250000.0,"monthly_budget_revenue":[89719.45,89719.45,179438.89,147057.13,147057.13,294114.26,156250,156250,312500,237500,237500,452893.69],"ytd_budget_revenue":1259606.31,"actual_revenue_ytd":308428.0,"actual_gp_ytd":15428.53,"monthly_actual_revenue":[0,0,190008.0,118420.0,0,0,0,0,0,0,0,0]},{"vendor":"Harness","owner":"Sheyyab","gp_pct":0.12,"budget_revenue":2500000,"budget_gp":300000.0,"monthly_budget_revenue":[89719.45,89719.45,179438.89,147057.13,147057.13,294114.26,156250,156250,312500,237500,237500,452893.69],"ytd_budget_revenue":1259606.31,"actual_revenue_ytd":653152.85,"actual_gp_ytd":75826.38,"monthly_actual_revenue":[0,415673.73,50532.46,0,0,131000.0,55946.66,0,0,0,0,0]},{"vendor":"Gigamon","owner":"Alezzeh","gp_pct":0.09,"budget_revenue":2000000.0,"budget_gp":180000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":123557.21,"actual_gp_ytd":13987.11,"monthly_actual_revenue":[0,122057.21,0,0,0,0,0,1500.0,0,0,0,0]},{"vendor":"Industrial Defender","owner":"Amr Elsayed","gp_pct":0.085,"budget_revenue":2000000.0,"budget_gp":170000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"TXOne","owner":"Amr Elsayed","gp_pct":0.12,"budget_revenue":2000000.0,"budget_gp":240000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":738829.66,"actual_gp_ytd":106567.21,"monthly_actual_revenue":[111412.0,0,85485.5,179061.4,40384.45,252057.32,47775.99,22653.0,0,0,0,0]},{"vendor":"Minio","owner":"Anas","gp_pct":0.075,"budget_revenue":2000000.0,"budget_gp":150000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":1722520.0,"actual_gp_ytd":121743.81,"monthly_actual_revenue":[253148.0,0,0,125399.0,76800.0,1220721.0,46452.0,0,0,0,0,0]},{"vendor":"Redseal","owner":"Tarek","gp_pct":0.35,"budget_revenue":2000000.0,"budget_gp":700000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":425196.5,"actual_gp_ytd":85840.5,"monthly_actual_revenue":[0,0,361601.5,63595.0,0,0,0,0,0,0,0,0]},{"vendor":"Akamai","owner":"Alezzeh","gp_pct":0.08,"budget_revenue":2000000.0,"budget_gp":160000.0,"monthly_budget_revenue":[71775.56,71775.56,143551.11,117645.71,117645.71,235291.41,125000,125000,250000,190000,190000,362314.95],"ytd_budget_revenue":1007685.06,"actual_revenue_ytd":131656.0,"actual_gp_ytd":14031.14,"monthly_actual_revenue":[0,0,0,0,0,14646.0,117010.0,0,0,0,0,0]},{"vendor":"GTB Technologies","owner":"Samreen","gp_pct":0.2,"budget_revenue":1850000.0,"budget_gp":370000.0,"monthly_budget_revenue":[66392.39,66392.39,132784.78,108822.28,108822.28,217644.56,115625,115625,231250,175750,175750,335141.33],"ytd_budget_revenue":932108.68,"actual_revenue_ytd":214747.19,"actual_gp_ytd":44198.09,"monthly_actual_revenue":[0,11846.75,0,39462.0,81698.0,32440.44,49300.0,0,0,0,0,0]},{"vendor":"Utimaco","owner":"Tarek","gp_pct":0.14,"budget_revenue":1500000.0,"budget_gp":210000.0,"monthly_budget_revenue":[53831.67,53831.67,107663.34,88234.28,88234.28,176468.56,93750,93750,187500,142500,142500,271736.21],"ytd_budget_revenue":755763.8,"actual_revenue_ytd":443591.38,"actual_gp_ytd":82690.02,"monthly_actual_revenue":[21831.6,0,12090.0,108736.31,0,2050.0,206647.0,92236.47,0,0,0,0]},{"vendor":"BlueCat","owner":"Faiz","gp_pct":0.1,"budget_revenue":1500000.0,"budget_gp":150000.0,"monthly_budget_revenue":[53831.67,53831.67,107663.34,88234.28,88234.28,176468.56,93750,93750,187500,142500,142500,271736.21],"ytd_budget_revenue":755763.8,"actual_revenue_ytd":834081.54,"actual_gp_ytd":110208.41,"monthly_actual_revenue":[85026.99,601692.55,0,0,0,147362.0,0,0,0,0,0,0]},{"vendor":"Countercraft","owner":"Tarek","gp_pct":0.2,"budget_revenue":1500000.0,"budget_gp":300000.0,"monthly_budget_revenue":[53831.67,53831.67,107663.34,88234.28,88234.28,176468.56,93750,93750,187500,142500,142500,271736.21],"ytd_budget_revenue":755763.8,"actual_revenue_ytd":327779.0,"actual_gp_ytd":16390.51,"monthly_actual_revenue":[0,0,0,0,327779.0,0,0,0,0,0,0,0]},{"vendor":"Appgate","owner":"Faiz","gp_pct":0.16,"budget_revenue":1250000,"budget_gp":200000.0,"monthly_budget_revenue":[44859.72,44859.72,89719.45,73528.57,73528.57,147057.13,78125,78125,156250,118750,118750,226446.84],"ytd_budget_revenue":629803.16,"actual_revenue_ytd":715377.14,"actual_gp_ytd":80837.64,"monthly_actual_revenue":[93478.32,13000.03,279066.4,39950.05,139989.85,107619.25,26651.24,15622.0,0,0,0,0]},{"vendor":"Cribl","owner":"Anas","gp_pct":0.095,"budget_revenue":1100000,"budget_gp":104500.0,"monthly_budget_revenue":[39476.56,39476.56,78953.11,64705.14,64705.14,129410.28,68750,68750,137500,104500,104500,199273.22],"ytd_budget_revenue":554226.79,"actual_revenue_ytd":462816.01,"actual_gp_ytd":50911.86,"monthly_actual_revenue":[0,0,5360.81,0,0,0,457455.19,0,0,0,0,0]},{"vendor":"Augur Security (Seclytics)","owner":"Tarek","gp_pct":0.12,"budget_revenue":1000000.0,"budget_gp":120000.0,"monthly_budget_revenue":[35887.78,35887.78,71775.56,58822.85,58822.85,117645.71,62500,62500,125000,95000,95000,181157.47],"ytd_budget_revenue":503842.53,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Invicti","owner":"Sheyyab","gp_pct":0.2,"budget_revenue":1000000,"budget_gp":200000.0,"monthly_budget_revenue":[0,0,0,0,0,0,100000,100000,200000,150000,150000,300000],"ytd_budget_revenue":200000,"actual_revenue_ytd":22000.0,"actual_gp_ytd":2200.0,"monthly_actual_revenue":[0,0,0,0,0,0,22000.0,0,0,0,0,0]},{"vendor":"Paladin AI","owner":"Saif","gp_pct":0.2,"budget_revenue":850000,"budget_gp":170000.0,"monthly_budget_revenue":[0,0,0,0,0,0,85000,85000,170000,127500,127500,255000],"ytd_budget_revenue":170000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Cyware","owner":"Samreen","gp_pct":0.12,"budget_revenue":750000.0,"budget_gp":90000.0,"monthly_budget_revenue":[26915.83,26915.83,53831.67,44117.14,44117.14,88234.28,46875,46875,93750,71250,71250,135868.11],"ytd_budget_revenue":377881.89,"actual_revenue_ytd":804244.69,"actual_gp_ytd":96201.69,"monthly_actual_revenue":[0,0,804244.69,0,0,0,0,0,0,0,0,0]},{"vendor":"Advenica","owner":"Amr Elsayed","gp_pct":0.15,"budget_revenue":750000.0,"budget_gp":112500.0,"monthly_budget_revenue":[26915.83,26915.83,53831.67,44117.14,44117.14,88234.28,46875,46875,93750,71250,71250,135868.11],"ytd_budget_revenue":377881.89,"actual_revenue_ytd":229940.0,"actual_gp_ytd":63374.87,"monthly_actual_revenue":[0,104000.0,125940.0,0,0,0,0,0,0,0,0,0]},{"vendor":"Teramind","owner":"Saif","gp_pct":0.12,"budget_revenue":550000,"budget_gp":66000.0,"monthly_budget_revenue":[0,0,0,0,0,0,55000,55000,110000,82500,82500,165000],"ytd_budget_revenue":110000,"actual_revenue_ytd":6458.0,"actual_gp_ytd":1663.0,"monthly_actual_revenue":[0,788.0,0,0,0,5670.0,0,0,0,0,0,0]},{"vendor":"GRC Vendor (TBD)","owner":"Tarek","gp_pct":0.15,"budget_revenue":500000,"budget_gp":75000.0,"monthly_budget_revenue":[0,0,0,0,0,0,50000,50000,100000,75000,75000,150000],"ytd_budget_revenue":100000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"H3/Ridge","owner":"Anas","gp_pct":0.12,"budget_revenue":500000.0,"budget_gp":60000.0,"monthly_budget_revenue":[17943.89,17943.89,35887.78,29411.43,29411.43,58822.85,31250,31250,62500,47500,47500,90578.74],"ytd_budget_revenue":251921.27,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Netwrix PS - Outsourced","owner":"PS","gp_pct":0.15,"budget_revenue":400000,"budget_gp":60000.0,"monthly_budget_revenue":[0,0,0,0,0,0,40000,40000,80000,60000,60000,120000],"ytd_budget_revenue":80000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Redseal PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":400000,"budget_gp":400000.0,"monthly_budget_revenue":[0,0,0,0,0,0,40000,40000,80000,60000,60000,120000],"ytd_budget_revenue":80000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Swimlane","owner":"Anas","gp_pct":0.15,"budget_revenue":250000.0,"budget_gp":37500.0,"monthly_budget_revenue":[8971.94,8971.94,17943.89,14705.71,14705.71,29411.43,15625,15625,31250,23750,23750,45289.37],"ytd_budget_revenue":125960.62,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Hexnode","owner":"Saif","gp_pct":0.15,"budget_revenue":250000,"budget_gp":37500.0,"monthly_budget_revenue":[0,0,0,0,0,0,25000,25000,50000,37500,37500,75000],"ytd_budget_revenue":50000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Nozomi","owner":"Amr Elsayed","gp_pct":0.08,"budget_revenue":250000.0,"budget_gp":20000.0,"monthly_budget_revenue":[8971.94,8971.94,17943.89,14705.71,14705.71,29411.43,15625,15625,31250,23750,23750,45289.37],"ytd_budget_revenue":125960.62,"actual_revenue_ytd":1491381.0,"actual_gp_ytd":126213.19,"monthly_actual_revenue":[0,0,0,0,0,0,1491381.0,0,0,0,0,0]},{"vendor":"ACCUKNOX","owner":"Samreen","gp_pct":0.15,"budget_revenue":250000.0,"budget_gp":37500.0,"monthly_budget_revenue":[8971.94,8971.94,17943.89,14705.71,14705.71,29411.43,15625,15625,31250,23750,23750,45289.37],"ytd_budget_revenue":125960.62,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Certes","owner":"Faiz","gp_pct":0.12,"budget_revenue":250000.0,"budget_gp":30000.0,"monthly_budget_revenue":[8971.94,8971.94,17943.89,14705.71,14705.71,29411.43,15625,15625,31250,23750,23750,45289.37],"ytd_budget_revenue":125960.62,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Ardent Privacy","owner":"Samreen","gp_pct":0.2,"budget_revenue":250000.0,"budget_gp":50000.0,"monthly_budget_revenue":[8971.94,8971.94,17943.89,14705.71,14705.71,29411.43,15625,15625,31250,23750,23750,45289.37],"ytd_budget_revenue":125960.62,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Fortra PS - Outsourced","owner":"PS","gp_pct":0.2,"budget_revenue":250000,"budget_gp":50000.0,"monthly_budget_revenue":[0,0,0,0,0,0,25000,25000,50000,37500,37500,75000],"ytd_budget_revenue":50000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Proofpoint PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":200000,"budget_gp":200000.0,"monthly_budget_revenue":[0,0,0,0,0,0,20000,20000,40000,30000,30000,60000],"ytd_budget_revenue":40000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Netskope PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":200000,"budget_gp":200000.0,"monthly_budget_revenue":[0,0,0,0,0,0,20000,20000,40000,30000,30000,60000],"ytd_budget_revenue":40000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"TxOne - Outsourced","owner":"PS","gp_pct":0.2,"budget_revenue":150000,"budget_gp":30000.0,"monthly_budget_revenue":[0,0,0,9000,9000,19500,12000,12000,24000,16500,16500,31500],"ytd_budget_revenue":61500,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"TXOne - Insourced","owner":"PS","gp_pct":1,"budget_revenue":150000,"budget_gp":150000.0,"monthly_budget_revenue":[0,0,0,0,0,0,15000,15000,30000,22500,22500,45000],"ytd_budget_revenue":30000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Crowdstrike - SIEM PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":100000,"budget_gp":100000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Solarwinds PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":100000,"budget_gp":100000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"GTB PS - Outsourced","owner":"PS","gp_pct":0.2,"budget_revenue":100000,"budget_gp":20000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Solarwinds PS - Outsourced","owner":"PS","gp_pct":0.15,"budget_revenue":100000,"budget_gp":15000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Entrust PS - Insourced","owner":"PS","gp_pct":1,"budget_revenue":100000,"budget_gp":100000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Advenica - Outsourced","owner":"PS","gp_pct":0.2,"budget_revenue":100000,"budget_gp":20000.0,"monthly_budget_revenue":[0,0,0,6000,6000,13000,8000,8000,16000,11000,11000,21000],"ytd_budget_revenue":41000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Advenica - Insourced","owner":"PS","gp_pct":1,"budget_revenue":100000,"budget_gp":100000.0,"monthly_budget_revenue":[0,0,0,6000,6000,13000,8000,8000,16000,11000,11000,21000],"ytd_budget_revenue":41000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"BlueCat - Insourced","owner":"PS","gp_pct":1,"budget_revenue":100000,"budget_gp":100000.0,"monthly_budget_revenue":[0,0,0,0,0,0,10000,10000,20000,15000,15000,30000],"ytd_budget_revenue":20000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"BlueCat - Outsourced","owner":"PS","gp_pct":0.15,"budget_revenue":100000,"budget_gp":15000.0,"monthly_budget_revenue":[0,0,0,6000,6000,13000,8000,8000,16000,11000,11000,21000],"ytd_budget_revenue":41000,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Security Scorecard","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":698380.74,"actual_gp_ytd":64691.37,"monthly_actual_revenue":[0,15542.1,37000.0,110878.0,35861.78,372506.28,79270.0,47322.58,0,0,0,0]},{"vendor":"Lookout","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":1113455.4,"actual_gp_ytd":79185.25,"monthly_actual_revenue":[0,14820.0,91268.14,6461.04,0,9338.0,991568.22,0,0,0,0,0]},{"vendor":"Digital.ai","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":897955.74,"actual_gp_ytd":74281.92,"monthly_actual_revenue":[0,84725.74,713615.0,0,0,99615.0,0,0,0,0,0,0]},{"vendor":"ThreatConnect","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Domain Tools","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":176192.47,"actual_gp_ytd":15857.47,"monthly_actual_revenue":[0,0,176192.47,0,0,0,0,0,0,0,0,0]},{"vendor":"Keyfactor","owner":"Tarek","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"ON2IT","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"FASOO","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Replil","owner":"Incubation","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]},{"vendor":"Mimic / Arms Cyber","owner":"Faiz","gp_pct":0,"budget_revenue":0,"budget_gp":0,"monthly_budget_revenue":[0,0,0,0,0,0,0,0,0,0,0,0],"ytd_budget_revenue":0,"actual_revenue_ytd":0,"actual_gp_ytd":0,"monthly_actual_revenue":[0,0,0,0,0,0,0,0,0,0,0,0]}];
const SEED_REGIONS = [{"region":"KSA","budget_revenue":92896174.86,"budget_gp":9984829.23,"actual_revenue_ytd":49472551.22,"actual_gp_ytd":5150833.88},{"region":"UAE","budget_revenue":39344262.3,"budget_gp":4228868.85,"actual_revenue_ytd":24725998.22,"actual_gp_ytd":2102387.08},{"region":"Qatar","budget_revenue":16393442.62,"budget_gp":1762028.69,"actual_revenue_ytd":5000711.39,"actual_gp_ytd":361046.34},{"region":"Kuwait","budget_revenue":5464480.87,"budget_gp":587342.9,"actual_revenue_ytd":4502846.31,"actual_gp_ytd":385419.09},{"region":"Bahrain","budget_revenue":5464480.87,"budget_gp":587342.9,"actual_revenue_ytd":2616910.49,"actual_gp_ytd":201668.27},{"region":"Oman","budget_revenue":2732240.44,"budget_gp":293671.45,"actual_revenue_ytd":662858.62,"actual_gp_ytd":72295.53},{"region":"Arabic Africa","budget_revenue":15300546.45,"budget_gp":1644560.11,"actual_revenue_ytd":11899453.85,"actual_gp_ytd":1354519.99},{"region":"Levant","budget_revenue":10928961.75,"budget_gp":1174685.79,"actual_revenue_ytd":8686306.9,"actual_gp_ytd":986004.36},{"region":"French Africa","budget_revenue":3825136.61,"budget_gp":411140.03,"actual_revenue_ytd":1404949.63,"actual_gp_ytd":191488.51},{"region":"Southern Africa","budget_revenue":3825136.61,"budget_gp":411140.03,"actual_revenue_ytd":1934888.79,"actual_gp_ytd":223172.01},{"region":"Eastern Africa","budget_revenue":2295081.97,"budget_gp":246684.02,"actual_revenue_ytd":1296787.52,"actual_gp_ytd":97229.82},{"region":"Western Africa","budget_revenue":1530054.64,"budget_gp":164456.01,"actual_revenue_ytd":474215.43,"actual_gp_ytd":46672.33}];
// vendor -> year -> [[month, country, revenue, gp], ...]  (2024, 2025, 2026 actuals from CIPR)
const VENDOR_HISTORY = {"Fortra":{"2026":[[8,"KSA",18458.0,9524.38],[7,"KSA",463035.0,102502.02],[7,"Arabic Africa",28130.0,5420.0],[7,"UAE",68939.21,27099.21],[7,"Qatar",19923.81,8968.87],[7,"French Africa",2144.0,2144.0],[7,"Western Africa",48994.42,3550.32],[6,"KSA",537434.0,105599.28],[6,"Arabic Africa",138095.57,29126.57],[6,"Qatar",55597.93,5046.81],[6,"Levant",649995.94,80227.07],[6,"UAE",32006.94,8565.94],[6,"Kuwait",49420.0,2480.0],[6,"French Africa",18580.0,3708.0],[5,"KSA",210999.0,73382.71],[5,"Levant",223517.25,43528.25],[5,"Kuwait",20252.0,5318.0],[5,"UAE",128330.0,23655.0],[5,"French Africa",9523.0,4761.0],[4,"KSA",86251.0,-49068.59],[4,"Kuwait",58306.89,9465.89],[4,"UAE",11700.0,806.7],[4,"Arabic Africa",-10000.0,-2768.0],[3,"KSA",674911.0,176168.24],[3,"Western Africa",3150.0,655.0],[3,"Bahrain",7113.77,1697.32],[3,"French Africa",1072.0,1072.0],[3,"Arabic Africa",31666.9,3164.9],[3,"UAE",3800.0,1772.0],[3,"Levant",173634.85,34727.85],[3,"Qatar",22825.0,3324.85],[3,"Kuwait",10714.52,2094.52],[2,"KSA",47522.0,798.32],[2,"French Africa",14778.0,6336.0],[2,"Kuwait",39265.0,8803.0],[2,"Bahrain",3650.0,650.0],[1,"KSA",63637.0,16972.99],[1,"UAE",10766.21,5896.21]],"2025":[[12,"French Africa",223211.35,45247.35],[12,"Rest of the world",4978.05,1906.05],[12,"Arabic Africa",209240.12,42815.12],[12,"Southern Africa",-69294.0,-5543.52],[12,"Western Africa",110894.0,20188.0],[12,"KSA",701136.0,236424.66],[12,"Qatar",42689.78,9966.57],[12,"Bahrain",58740.0,8060.0],[12,"UAE",81555.48,19734.48],[12,"Levant",42076.6,4430.6],[12,"Kuwait",5973.7,2389.7],[11,"UAE",152713.74,-41857.26],[11,"KSA",109113.0,15398.28],[11,"Arabic Africa",99104.5,18190.37],[11,"French Africa",8812.5,3124.5],[11,"Qatar",6103.39,1103.26],[11,"Kuwait",12406.5,2791.5],[10,"KSA",212763.0,76439.04],[10,"Arabic Africa",122422.9,25046.9],[10,"UAE",39942.18,2745.16],[10,"Western Africa",1265.0,252.0],[10,"Qatar",43346.3,9134.21],[10,"French Africa",21895.12,5895.12],[10,"Levant",27489.0,5398.0],[10,"Oman",14541.0,2912.0],[9,"Levant",16216.5,2599.5],[9,"UAE",13929.0,5864.8],[9,"KSA",645305.0,110169.52],[9,"French Africa",94030.11,22018.11],[9,"Qatar",15000.0,3574.0],[9,"Arabic Africa",45434.2,7728.2],[8,"KSA",210012.0,51607.49],[8,"Arabic Africa",71239.4,14288.4],[8,"Qatar",6500.0,2836.0],[8,"Southern Africa",69294.0,5544.0],[7,"KSA",503565.0,88568.77],[7,"Bahrain",9647.06,1447.06],[7,"UAE",33654.83,3758.51],[7,"Qatar",40254.28,6047.28],[6,"Arabic Africa",98125.68,17915.92],[6,"KSA",561753.0,93122.19],[6,"Levant",40549.08,13787.08],[6,"French Africa",-15286.09,-1525.55],[6,"Qatar",72692.0,19095.14],[6,"Eastern Africa",14080.0,1411.0],[5,"Levant",97686.85,20568.85],[5,"French Africa",41072.54,2408.54],[5,"Kuwait",48471.38,7159.38],[5,"UAE",45329.19,11344.51],[5,"KSA",58869.0,17460.36],[5,"Qatar",1134.7,180.7],[5,"Arabic Africa",3520.0,890.0],[4,"Kuwait",78804.0,10881.0],[4,"UAE",3784.0,756.0],[3,"KSA",105197.0,25900.97],[3,"Arabic Africa",13000.0,8789.0],[3,"UAE",354809.82,18905.81],[3,"Kuwait",6100.0,2107.0],[3,"Qatar",1945.24,97.24],[3,"Bahrain",71345.4,16409.4],[3,"Levant",42564.0,6188.0],[2,"UAE",7700.0,1192.0],[2,"Bahrain",5526.46,1416.46],[2,"KSA",94208.0,29570.27],[1,"KSA",162696.0,31069.89],[1,"Qatar",11247.0,3548.97],[1,"French Africa",9986.58,1946.58],[1,"UAE",7390.24,2661.24],[1,"Arabic Africa",14735.53,2210.53]],"2024":[[12,"Levant",41896.0,4366.0],[12,"Qatar",169980.99,33706.99],[12,"KSA",1091577.0,197762.74],[12,"UAE",124687.19,25002.19],[12,"Arabic Africa",163308.7,19908.7],[12,"French Africa",5679.0,1448.0],[12,"Bahrain",54155.0,5765.0],[12,"Oman",4177.2,418.2],[11,"KSA",43648.0,10146.92],[11,"French Africa",42129.67,5647.67],[11,"Qatar",6666.67,666.67],[11,"Kuwait",47320.0,9535.0],[11,"Levant",7794.5,1301.5],[11,"Oman",4176.66,417.66],[10,"KSA",140785.0,32791.0],[10,"Levant",21582.18,3371.18],[10,"Arabic Africa",13424.74,2565.74],[10,"Kuwait",4267.6,1706.6],[10,"Qatar",13266.0,3696.0],[10,"UAE",7530.54,692.54],[9,"Oman",9737.5,1947.5],[9,"Qatar",30523.84,8488.84],[9,"KSA",236245.0,49765.52],[9,"Eastern Africa",4425.0,590.0],[9,"UAE",32400.0,6820.0],[9,"Kuwait",4500.0,500.0],[8,"UAE",8319.0,810.0],[8,"KSA",254226.0,54985.45],[8,"Qatar",21951.63,2188.63],[7,"Bahrain",38631.0,5408.03],[7,"UAE",9523.05,1572.05],[7,"KSA",12934.0,4628.72],[7,"Arabic Africa",3340.0,830.0],[6,"French Africa",12345.82,3826.82],[6,"KSA",231455.0,95558.09],[6,"UAE",13963.54,1871.54],[6,"Kuwait",29305.0,9090.0],[6,"Bahrain",18300.0,6300.0],[6,"Qatar",1400.0,200.0],[5,"Levant",186880.8,55198.8],[5,"KSA",130033.0,23710.02],[5,"Kuwait",6010.52,2251.52],[5,"Arabic Africa",7404.62,2102.62],[5,"Qatar",44504.0,8321.0],[5,"UAE",1753.57,253.57],[4,"Kuwait",45123.55,12181.55],[4,"Qatar",57640.0,17976.0],[4,"French Africa",28411.5,10664.5],[4,"KSA",117800.0,16487.11],[3,"KSA",453530.0,133523.34],[3,"UAE",94506.0,23659.0],[3,"Qatar",10656.0,1248.0],[3,"Levant",47970.0,10055.0],[3,"Bahrain",5345.39,1534.39],[3,"Arabic Africa",41460.0,9060.0],[2,"Arabic Africa",107640.0,53049.0],[2,"UAE",3576.31,714.31],[2,"Qatar",3030.8,1060.8],[2,"KSA",77803.0,31873.26],[1,"KSA",38880.0,16841.06],[1,"UAE",14940.0,4320.0],[1,"Arabic Africa",18063.0,3613.0]]},"Crowdstrike":{"2026":[[8,"UAE",55566.46,2799.46],[8,"KSA",12672.0,635.94],[8,"Levant",17108.0,856.0],[7,"Rest of the world",14770.0,891.0],[7,"UAE",1911030.87,101770.12],[7,"Levant",130495.8,8395.51],[7,"KSA",746131.0,50022.87],[7,"Arabic Africa",1701860.78,168530.78],[7,"Qatar",489975.48,31828.45],[7,"Kuwait",127590.0,6402.0],[7,"French Africa",26666.66,2672.15],[7,"Bahrain",90569.34,6079.34],[6,"Qatar",-39422.0,-30372.07],[6,"Arabic Africa",241337.82,12066.82],[6,"UAE",901271.74,61176.21],[6,"French Africa",59263.0,4072.09],[6,"Rest of the world",95000.0,9435.0],[6,"Bahrain",37940.0,2856.0],[6,"KSA",3290301.13,225201.33],[6,"Kuwait",1252081.0,61637.0],[6,"Levant",1340890.8,81242.96],[6,"Oman",48720.0,2925.0],[5,"UAE",563673.36,52209.96],[5,"Qatar",470699.53,52433.56],[5,"Arabic Africa",143350.0,7171.0],[5,"KSA",886147.14,55112.41],[5,"Bahrain",15450.0,796.0],[5,"Levant",230478.93,16108.93],[5,"Rest of the world",3500.01,517.01],[4,"Kuwait",104802.0,5983.0],[4,"Levant",527114.4,32223.79],[4,"UAE",1438510.63,72450.43],[4,"Rest of the world",694669.0,73687.0],[4,"Arabic Africa",986420.0,78920.0],[4,"KSA",664095.0,56646.66],[4,"Qatar",157598.49,12444.3],[4,"Oman",49665.0,3050.0],[3,"KSA",1096755.78,68742.28],[3,"UAE",931331.97,47166.33],[3,"Levant",139014.99,8306.99],[3,"Bahrain",20285.0,1922.0],[3,"Rest of the world",366017.0,22004.0],[3,"Kuwait",665.0,101.0],[3,"Oman",219294.9,14354.9],[2,"Arabic Africa",62370.0,3973.32],[2,"UAE",307785.79,27117.27],[2,"Bahrain",61960.0,7611.74],[2,"KSA",169004.0,17586.93],[2,"Levant",1728.0,180.27],[1,"KSA",1048178.0,115556.02],[1,"UAE",1562010.4,125321.8],[1,"Arabic Africa",319800.0,26799.01],[1,"Kuwait",225540.4,16795.75],[1,"Levant",547614.87,58976.6],[1,"Rest of the world",644600.0,57592.65],[1,"French Africa",2800.0,594.69],[1,"Bahrain",125498.0,11667.42]],"2025":[[12,"Levant",274342.0,41105.12],[12,"KSA",692296.0,40145.07],[12,"Qatar",92485.45,8073.46],[12,"UAE",698369.59,38822.71],[12,"Kuwait",131520.6,7634.6],[12,"Arabic Africa",202386.0,8172.0],[12,"French Africa",88040.0,4952.04],[12,"Bahrain",83700.0,5029.0],[11,"KSA",3521411.0,368120.16],[11,"French Africa",11200.0,1450.25],[11,"Qatar",64297.53,11666.36],[11,"UAE",1112475.27,64099.3],[11,"Levant",3860.4,233.4],[10,"Qatar",22358.01,1368.48],[10,"KSA",2172936.97,123809.99],[10,"Levant",45626.65,3169.65],[10,"Rest of the world",189756.0,14074.0],[10,"UAE",231243.82,13581.61],[10,"Kuwait",12003.0,853.0],[10,"Bahrain",73800.11,5071.11],[10,"Oman",69545.51,4174.36],[10,"Arabic Africa",189180.0,5681.26],[9,"UAE",1176739.46,125564.14],[9,"Kuwait",35573.0,2248.0],[9,"KSA",872133.0,93896.52],[9,"Bahrain",105580.8,7389.8],[9,"Levant",97485.09,6441.09],[9,"Arabic Africa",193302.0,10122.0],[9,"Qatar",97383.0,5843.99],[8,"UAE",515288.33,30743.35],[8,"KSA",1443230.0,76374.17],[8,"Bahrain",19270.0,975.0],[8,"Kuwait",44053.3,2880.3],[7,"Qatar",158910.96,14266.16],[7,"KSA",445507.29,25848.44],[7,"UAE",623640.71,30886.2],[7,"Kuwait",48336.4,2506.4],[7,"Levant",88202.13,9693.13],[7,"French Africa",70446.0,4966.68],[7,"Arabic Africa",55503.5,3921.5],[7,"Bahrain",256600.0,13742.0],[6,"KSA",1067297.0,65836.46],[6,"Bahrain",61153.14,4471.14],[6,"Arabic Africa",390100.0,19587.0],[6,"Levant",41387.0,2327.0],[6,"UAE",59873.9,3583.89],[6,"Qatar",357012.15,22368.03],[6,"Kuwait",109392.0,6796.0],[5,"Qatar",372847.91,36900.73],[5,"KSA",495126.0,41847.97],[5,"UAE",729035.14,37147.83],[5,"Levant",388365.37,28012.37],[5,"Kuwait",530203.5,33668.5],[4,"KSA",1981649.0,118392.9],[4,"Levant",979411.9,71365.9],[4,"UAE",190224.23,9581.21],[4,"Qatar",117589.0,8026.06],[4,"French Africa",1400.0,250.0],[4,"Kuwait",30548.4,2140.4],[4,"Oman",220570.0,14279.0],[3,"UAE",450508.09,27333.09],[3,"French Africa",40157.38,5779.23],[3,"KSA",62043.0,4393.96],[3,"Qatar",28846.6,1526.56],[3,"Levant",44130.49,3160.49],[3,"Kuwait",45064.5,2272.5],[3,"Bahrain",36144.0,3645.0],[3,"Rest of the world",427965.0,48260.16],[3,"Arabic Africa",104450.0,10445.0],[2,"Bahrain",91862.0,5512.0],[2,"UAE",788750.32,20958.32],[2,"Levant",178092.0,17578.0],[2,"Oman",56186.0,4625.0],[2,"KSA",509609.0,29636.36],[2,"Kuwait",126318.0,6948.0],[2,"Rest of the world",148711.5,11002.59],[1,"KSA",1194093.0,90736.41],[1,"Arabic Africa",90025.0,4490.19],[1,"UAE",928583.44,38112.0],[1,"Levant",129064.5,8705.5],[1,"Rest of the world",630600.0,35023.23],[1,"Qatar",98769.01,4940.02]],"2024":[[12,"Bahrain",370958.0,14952.11],[12,"Levant",47785.5,3766.5],[12,"Arabic Africa",14605.0,1055.0],[12,"French Africa",26666.66,2671.99],[12,"KSA",654443.0,44459.25],[12,"Qatar",623600.0,22328.77],[12,"UAE",958739.62,50482.0],[11,"UAE",189097.26,12009.26],[11,"KSA",1233146.0,142695.25],[11,"Arabic Africa",217313.1,15743.11],[11,"Kuwait",121960.0,7464.0],[11,"Levant",3450.3,233.3],[10,"Qatar",91628.4,10086.9],[10,"Bahrain",52240.23,4319.23],[10,"Levant",41207.9,2893.9],[10,"UAE",368116.27,29372.52],[10,"KSA",861744.0,67858.22],[10,"Rest of the world",20175.0,2407.0],[10,"Kuwait",102520.77,5914.77],[9,"KSA",1271871.0,66673.55],[9,"UAE",919182.71,39088.42],[9,"Levant",58349.64,3884.64],[9,"Kuwait",29278.03,1823.03],[9,"Arabic Africa",100005.0,7305.0],[9,"Qatar",88339.5,4441.5],[8,"Rest of the world",57095.5,2877.5],[8,"UAE",42182.7,2898.13],[8,"KSA",154305.0,11805.62],[8,"Kuwait",88094.74,4068.74],[8,"Levant",50365.0,3517.0],[7,"UAE",146397.8,8401.8],[7,"Kuwait",117387.0,7201.0],[7,"KSA",1199654.91,70606.33],[7,"Levant",50868.7,3421.7],[7,"Bahrain",72908.8,5109.8],[6,"UAE",66790.29,4777.62],[6,"Bahrain",17127.0,856.0],[6,"Levant",24997.5,1337.5],[6,"Kuwait",85880.0,5154.0],[6,"Arabic Africa",51000.0,3601.0],[5,"Kuwait",417600.0,25320.0],[5,"French Africa",40157.38,2195.18],[5,"UAE",198545.73,10240.92],[5,"KSA",65932.0,3416.96],[5,"Levant",789821.65,58625.65],[5,"Rest of the world",1684.0,326.0],[5,"Qatar",3326.9,167.9],[4,"UAE",89381.98,5120.98],[4,"Levant",112409.5,7451.5],[4,"Kuwait",85732.0,4516.0],[4,"KSA",595723.0,39161.21],[4,"Qatar",21500.5,1081.5],[4,"Oman",155246.0,20790.0],[3,"KSA",222643.0,15959.76],[3,"Levant",181739.3,10301.3],[3,"UAE",102219.59,7085.59],[3,"Rest of the world",315028.15,42187.15],[3,"Qatar",156819.92,12221.15],[3,"Bahrain",34041.0,3132.0],[2,"KSA",677469.67,51197.57],[2,"Qatar",27560.0,3247.0],[2,"UAE",71124.16,5235.16],[2,"Kuwait",2940.0,178.0],[2,"Levant",34800.0,2441.0],[1,"Bahrain",387744.0,16365.0],[1,"KSA",460125.0,21810.72],[1,"Levant",270253.1,34051.14],[1,"UAE",1280804.98,42243.47],[1,"Kuwait",44540.0,4950.0],[1,"Qatar",500000.0,15000.0]]},"Netskope":{"2026":[[8,"Kuwait",10839.8,758.4],[8,"Bahrain",40563.88,4867.88],[7,"UAE",614080.94,59321.68],[7,"Arabic Africa",118080.0,18149.0],[7,"KSA",927578.0,96454.55],[6,"UAE",49398.96,3358.56],[6,"KSA",306722.17,40258.77],[5,"Bahrain",678624.87,35246.23],[5,"UAE",359755.28,30901.66],[5,"KSA",10178.0,874.06],[4,"KSA",277526.0,20071.62],[4,"Levant",240000.0,21589.5],[4,"Qatar",555655.76,37658.75],[4,"UAE",100723.85,6536.51],[3,"KSA",1532487.0,112145.42],[3,"Arabic Africa",25911.0,6766.0],[3,"UAE",103389.05,6177.07],[2,"KSA",61600.0,8069.28],[1,"Arabic Africa",122826.73,12378.73],[1,"KSA",96589.0,6434.73]],"2025":[[12,"KSA",341977.0,23597.51],[12,"UAE",7973.38,560.38],[12,"Levant",177104.19,1738.67],[11,"UAE",50880.11,3690.42],[11,"KSA",125497.0,10080.26],[11,"Qatar",157222.68,13831.55],[10,"UAE",158525.34,15541.34],[10,"KSA",441853.5,31269.5],[9,"Kuwait",629190.0,45533.0],[9,"UAE",552057.62,40364.3],[8,"KSA",182369.0,12263.38],[8,"UAE",23703.2,2331.2],[8,"Kuwait",10839.95,758.54],[7,"Levant",59017.0,6299.0],[7,"Arabic Africa",45060.4,4056.4],[7,"Bahrain",11632.25,815.25],[7,"UAE",100000.0,6999.86],[7,"KSA",32502.0,1992.37],[6,"Levant",78861.0,4704.0],[6,"KSA",82431.83,5918.83],[6,"UAE",38888.57,2833.57],[5,"UAE",34051.64,1724.35],[5,"Qatar",126167.0,12541.0]]},"Group IB":{"2026":[[8,"Kuwait",479000.0,38320.0],[8,"French Africa",57578.13,12578.13],[8,"KSA",155111.0,69041.78],[7,"KSA",240000.0,24000.3],[7,"Kuwait",151200.0,10700.0],[7,"Qatar",154424.79,11542.01],[7,"Arabic Africa",305992.95,21422.95],[7,"Levant",172003.0,13766.0],[6,"KSA",-175933.0,10656.89],[6,"Qatar",593676.11,53363.24],[6,"Levant",136152.26,10892.26],[6,"UAE",434000.0,13019.84],[6,"Arabic Africa",216540.37,19173.75],[5,"Levant",433709.67,36951.69],[5,"Arabic Africa",359345.0,32147.0],[5,"KSA",1129230.0,79044.5],[4,"KSA",142299.0,11824.15],[4,"Qatar",118734.21,11349.32],[3,"KSA",280710.0,17662.3],[3,"Levant",540605.96,52000.82],[3,"Arabic Africa",73560.0,6710.0],[2,"Arabic Africa",64050.71,5764.8],[2,"KSA",1055660.0,75854.35],[2,"Southern Africa",35322.58,2472.58],[2,"UAE",21505.38,1505.38],[2,"French Africa",10588.26,1088.26],[1,"KSA",1133503.0,63360.82],[1,"UAE",175162.9,13507.9],[1,"Arabic Africa",1114273.92,167823.92],[1,"Qatar",78902.13,6766.25]],"2025":[[12,"KSA",4356558.0,292836.0],[12,"Arabic Africa",254650.0,19650.0],[12,"UAE",1484857.99,77068.0],[12,"Levant",304285.62,37331.62],[11,"KSA",480793.0,35122.24],[11,"Arabic Africa",54000.03,8640.03],[11,"Qatar",145300.51,13888.39],[11,"Levant",28089.88,3089.88],[10,"UAE",776535.47,48385.47],[10,"KSA",755965.0,53120.33],[10,"French Africa",183000.13,27450.13],[9,"KSA",297460.0,24672.13],[9,"Levant",170634.41,18976.41],[9,"UAE",140790.66,8716.66],[9,"Arabic Africa",53334.0,5334.0],[8,"KSA",894016.0,59219.6],[8,"Levant",632762.0,65759.5],[8,"Arabic Africa",760030.78,61990.78],[7,"UAE",726200.0,34891.94],[7,"KSA",588256.0,40307.81],[7,"Qatar",58093.2,5093.06],[7,"Kuwait",151200.0,10700.0],[7,"Arabic Africa",688443.37,60513.37],[6,"Arabic Africa",337818.56,28529.56],[6,"Kuwait",197771.73,19771.73],[6,"KSA",-117629.0,-9410.32],[5,"Arabic Africa",305067.2,25562.2],[5,"KSA",348816.0,26575.45],[5,"Levant",129215.0,10378.0],[5,"Qatar",376989.25,29169.25],[4,"Levant",40450.0,4450.0],[4,"KSA",350579.0,14197.6],[4,"Arabic Africa",47322.0,3322.0],[3,"Arabic Africa",295460.25,35455.25],[3,"KSA",518319.0,28489.07],[3,"Kuwait",137000.0,13700.0],[3,"Levant",220475.0,24275.0],[2,"KSA",598919.0,43017.01],[2,"UAE",52608.7,4208.7],[2,"Qatar",53761.64,3761.64],[1,"KSA",480419.0,37082.65],[1,"Arabic Africa",257878.45,20128.45],[1,"UAE",50000.0,3500.0]],"2024":[[12,"UAE",341006.51,24931.51],[12,"Arabic Africa",190087.91,17426.91],[12,"KSA",2922873.0,228320.99],[12,"Levant",126420.0,14026.0],[11,"KSA",3630898.0,341102.6],[11,"Levant",376470.0,41520.0],[11,"Arabic Africa",83861.0,7861.0],[11,"French Africa",112883.49,22576.49],[11,"Kuwait",140000.0,14000.0],[10,"Levant",58835.0,6485.0],[10,"UAE",49951.09,3996.09],[10,"Kuwait",16304.0,1304.0],[9,"KSA",1484153.0,118388.31],[9,"Arabic Africa",57277.78,5277.78],[9,"Levant",158195.0,18095.0],[9,"French Africa",205530.0,37530.0],[8,"Levant",134165.0,16107.0],[8,"Qatar",121000.0,10238.1],[8,"KSA",3398952.0,223412.93],[8,"Kuwait",135000.0,9500.0],[7,"Levant",227570.04,23537.04],[7,"Arabic Africa",80650.27,4032.27],[7,"KSA",186645.0,13157.08],[6,"Levant",37520.04,4128.04],[6,"UAE",0.0,0.84],[6,"KSA",281750.0,22289.66],[6,"Qatar",72176.66,6407.83],[5,"Arabic Africa",1271030.65,145012.65],[5,"KSA",331370.0,25143.34],[4,"UAE",34000.0,2750.0],[4,"KSA",190537.0,16541.0],[4,"Arabic Africa",136002.76,10879.76],[3,"KSA",430178.0,36552.22],[3,"Kuwait",66667.0,6666.0],[3,"Arabic Africa",211173.92,16873.92],[2,"KSA",1080304.0,85885.13],[2,"Arabic Africa",258937.2,27683.2],[1,"UAE",143388.7,12298.7],[1,"Arabic Africa",161391.0,15241.0]]},"Appgate":{"2026":[[8,"Oman",15622.0,2054.0],[7,"Qatar",26651.24,4243.34],[6,"UAE",107619.25,12914.25],[5,"UAE",134156.5,16652.5],[5,"Qatar",5833.35,892.49],[4,"UAE",6335.8,641.8],[4,"KSA",12595.0,1526.06],[4,"Kuwait",21019.25,2102.25],[3,"KSA",93967.0,15887.15],[3,"Qatar",181150.0,10899.76],[3,"UAE",3949.4,490.4],[2,"UAE",13000.03,2085.03],[1,"KSA",22081.0,3311.29],[1,"UAE",71397.32,7137.32]],"2025":[[12,"KSA",34688.0,4273.07],[12,"Arabic Africa",131111.0,25323.0],[11,"UAE",52697.89,7697.89],[10,"Qatar",86950.9,17116.99],[10,"UAE",32496.0,3956.0],[10,"Arabic Africa",16697.5,3047.5],[9,"KSA",49441.0,12017.36],[9,"UAE",37346.0,3743.45],[8,"UAE",21948.0,2910.0],[8,"Oman",15623.0,2055.0],[7,"UAE",28970.93,4360.93],[6,"KSA",246539.0,53961.5],[6,"UAE",212090.0,18160.1],[5,"UAE",4373.5,663.5],[5,"Qatar",51550.0,4300.0],[4,"UAE",8643.5,1353.5],[4,"Kuwait",18016.5,1801.5],[3,"UAE",45879.42,12183.42],[3,"Oman",10800.0,1200.0],[2,"KSA",21816.65,3046.65]],"2024":[[12,"UAE",144996.69,14769.69],[12,"Kuwait",2896.88,578.88],[10,"UAE",44446.0,4843.45],[10,"KSA",35906.0,8730.96],[10,"Qatar",91126.93,8911.33],[10,"Arabic Africa",15528.0,3528.0],[9,"UAE",122326.97,13419.97],[8,"UAE",5050.0,550.0],[8,"Oman",14400.0,1600.0],[7,"Qatar",-103100.0,-8845.98],[7,"UAE",76933.44,5378.44],[7,"Kuwait",2750.5,136.5],[6,"UAE",10200.0,1200.0],[5,"UAE",6455.75,1918.75],[5,"Kuwait",13288.75,1328.75],[5,"Qatar",2010.0,210.0],[4,"UAE",47408.1,12340.1],[4,"Levant",3005.8,457.8],[3,"UAE",3100.2,310.2],[3,"Qatar",216770.0,18609.0],[2,"KSA",20788.76,2912.76],[1,"Qatar",4870.0,-113.0],[1,"UAE",131267.3,13132.3]]},"Elastic":{"2026":[[8,"KSA",7200.0,437.02],[8,"UAE",59421.58,12247.18],[7,"UAE",710899.3,52646.23],[7,"KSA",1380656.0,69405.21],[7,"Arabic Africa",302457.3,14195.41],[7,"Qatar",21600.08,996.13],[7,"Kuwait",-111318.24,-12066.9],[7,"Bahrain",39744.0,2414.5],[6,"UAE",131241.81,10781.89],[6,"KSA",331400.0,16926.33],[6,"French Africa",31725.0,1819.02],[5,"Levant",32364.75,3756.81],[5,"Arabic Africa",137700.0,20811.14],[5,"KSA",645006.0,83051.75],[5,"UAE",247976.52,204121.67],[4,"UAE",559606.47,93455.19],[4,"KSA",727983.0,87068.26],[4,"Arabic Africa",158064.52,52237.67],[4,"Levant",56206.66,8069.77],[4,"French Africa",22140.0,2742.12],[3,"UAE",-8591.37,-28798.97],[3,"KSA",578880.0,64972.44],[3,"Qatar",147213.83,21757.87],[2,"KSA",751739.0,86170.16],[2,"UAE",221252.73,8139.68],[2,"Rest of the world",25460.0,2787.4],[2,"Arabic Africa",36450.0,6219.48],[2,"French Africa",426227.01,55334.11],[2,"Levant",177401.7,19481.76],[1,"KSA",475390.0,58433.98],[1,"Qatar",17394.67,2391.69],[1,"French Africa",197700.0,34028.8],[1,"Levant",63954.84,8945.84],[1,"UAE",193107.95,26840.86]],"2025":[[12,"Levant",46863.99,6402.19],[12,"KSA",372016.0,46256.14],[12,"UAE",117058.64,15820.64],[12,"Kuwait",208721.7,22618.7],[12,"Bahrain",87136.63,11641.82],[11,"KSA",687004.0,94844.35],[11,"UAE",378012.22,164588.01],[11,"Levant",55024.67,6166.67],[11,"French Africa",328050.0,97990.0],[10,"UAE",335089.94,72626.64],[10,"KSA",539493.0,91735.0],[10,"French Africa",38190.0,13627.8],[9,"KSA",271650.0,46662.0],[9,"UAE",249912.95,34020.67],[9,"Arabic Africa",67500.0,7216.72],[8,"Levant",12248.44,3712.64],[8,"French Africa",91125.0,17438.4],[8,"Qatar",21660.0,2799.84],[8,"UAE",209931.53,47688.52],[7,"UAE",435378.07,66640.42],[7,"KSA",1019771.0,142328.65],[7,"Qatar",3588.0,359.0],[7,"Levant",268000.0,40495.0],[7,"Arabic Africa",83995.01,14231.81],[7,"Bahrain",38760.0,7934.4],[6,"Arabic Africa",189924.0,35143.2],[6,"KSA",179560.0,20936.61],[6,"French Africa",21000.0,4277.0],[6,"Kuwait",83488.68,4231.55],[6,"UAE",149529.86,24879.06],[5,"KSA",326445.0,19960.41],[5,"UAE",124166.4,17254.4],[5,"Levant",21600.0,8121.6],[4,"UAE",122240.0,15427.2],[4,"Western Africa",21000.0,3694.4],[4,"KSA",1298728.0,144098.98],[4,"Rest of the world",9600.0,1280.0],[3,"KSA",302080.0,47945.86],[3,"UAE",16000.0,1960.0],[3,"French Africa",134016.0,18816.0],[2,"KSA",386750.49,48167.66],[2,"Rest of the world",9600.0,999.19],[2,"Arabic Africa",19439.99,4838.39],[1,"KSA",467247.99,64854.09],[1,"Arabic Africa",32400.0,8064.0],[1,"Levant",48959.98,10022.38],[1,"Qatar",16199.99,2159.99]],"2024":[[12,"KSA",766263.0,105193.64],[12,"UAE",418561.0,94873.8],[12,"Rest of the world",28144.0,3184.0],[12,"French Africa",81920.01,18022.41],[12,"Qatar",23769.23,4487.63],[11,"KSA",198235.0,41250.43],[11,"UAE",96400.38,16614.65],[11,"Rest of the world",8960.0,640.0],[11,"Kuwait",85995.53,14279.53],[10,"KSA",364360.0,133694.55],[10,"UAE",113385.65,9470.5],[10,"French Africa",44550.0,14832.0],[9,"UAE",1018889.93,123893.05],[9,"Kuwait",30720.0,4761.6],[9,"Arabic Africa",64000.01,15857.79],[9,"KSA",421499.0,132153.85],[8,"UAE",202781.58,37837.57],[8,"KSA",63056.0,22949.84],[7,"KSA",247680.0,29375.64],[7,"Qatar",25008.59,7177.99],[7,"UAE",213318.52,32537.12],[7,"Levant",357700.03,69339.23],[6,"Rest of the world",8190.0,280.8],[6,"KSA",220160.0,33458.76],[6,"UAE",180018.0,28838.4],[6,"Arabic Africa",21600.0,8121.6],[5,"Arabic Africa",126120.01,24376.81],[5,"KSA",39019.0,4236.43],[4,"KSA",1466563.0,118261.69],[4,"Rest of the world",8190.0,280.8],[4,"UAE",96623.99,16315.08],[3,"KSA",217674.0,46648.86],[2,"KSA",384970.0,41828.16],[2,"Rest of the world",8775.0,1474.19],[1,"KSA",197502.0,23405.66],[1,"Arabic Africa",35100.0,13197.6],[1,"Rest of the world",26325.0,2597.4],[1,"Levant",24750.0,4158.0]]},"Gigamon":{"2026":[[8,"Unknown",1500.0,1500.0],[2,"UAE",120810.21,11240.11],[2,"Southern Africa",1247.0,1247.0]],"2025":[[12,"KSA",136323.0,25091.6],[11,"UAE",273584.59,34019.02],[10,"UAE",3608.35,1066.35],[9,"KSA",386284.0,29625.42],[9,"Western Africa",26532.81,3183.81],[8,"KSA",445581.0,35323.28],[6,"UAE",5642.0,781.43],[5,"Rest of the world",77859.76,5804.94],[3,"KSA",77725.0,15436.93]],"2024":[[12,"KSA",0.0,-0.99],[11,"UAE",58186.0,4649.08],[11,"KSA",56744.0,5378.75],[7,"KSA",252250.0,20373.26]]},"Utimaco":{"2026":[[8,"Arabic Africa",92236.47,12968.47],[7,"KSA",206647.0,42142.35],[6,"Arabic Africa",2050.0,750.0],[4,"Qatar",34736.31,4687.26],[4,"KSA",74000.0,11332.42],[3,"UAE",12090.0,1337.92],[1,"KSA",21831.6,9471.6]],"2025":[[12,"KSA",46510.0,3762.43],[12,"Arabic Africa",83654.96,11528.62],[10,"Arabic Africa",131672.88,10512.88],[10,"Levant",5343.75,1068.75],[9,"Arabic Africa",105600.0,17115.0],[8,"Arabic Africa",14258.82,2138.82],[7,"Arabic Africa",185099.6,22199.43],[6,"Arabic Africa",0.0,3912.48],[5,"Arabic Africa",15688.88,1395.45],[4,"Kuwait",216657.0,36636.16],[4,"Arabic Africa",148814.46,14733.02],[3,"KSA",242817.0,32552.5],[3,"Qatar",-3000.0,-608.1],[1,"Arabic Africa",4000.0,757.33],[1,"UAE",27960.0,3174.17]],"2024":[[12,"Arabic Africa",64568.2,10388.2],[12,"UAE",96929.15,9493.89],[10,"Qatar",231680.91,46965.7],[9,"Arabic Africa",102106.74,20904.47],[8,"UAE",750.0,750.0],[6,"Arabic Africa",259526.52,46479.82],[6,"Levant",26783.64,3153.41],[3,"Arabic Africa",166463.12,60613.12]]},"Proofpoint":{"2026":[[8,"Levant",6690.0,685.0],[8,"French Africa",26800.0,4901.05],[7,"KSA",488968.0,74094.88],[7,"French Africa",15878.66,2622.77],[7,"UAE",135372.22,12331.58],[7,"Bahrain",71880.0,5802.0],[7,"Levant",6974.0,1408.0],[7,"Qatar",34841.45,2769.56],[6,"UAE",407267.38,18826.25],[6,"French Africa",110196.75,7174.07],[6,"Arabic Africa",390030.37,32401.87],[6,"Levant",197525.0,11227.0],[6,"Kuwait",67879.0,4900.0],[6,"KSA",-85000.0,-25625.42],[5,"KSA",61499.0,8895.6],[5,"Arabic Africa",88741.27,5324.27],[5,"UAE",225290.86,30019.53],[5,"Qatar",30252.74,5267.85],[5,"Western Africa",83147.2,6235.2],[4,"KSA",159496.0,11166.09],[4,"UAE",78193.06,13356.06],[4,"Qatar",79125.0,13871.9],[4,"Arabic Africa",329820.12,43400.23],[4,"French Africa",6000.0,654.06],[3,"French Africa",5960.0,599.08],[3,"KSA",1473959.0,102289.92],[3,"Arabic Africa",52105.05,3647.98],[3,"UAE",36171.59,3606.58],[3,"Kuwait",132470.0,9954.01],[3,"Bahrain",28017.55,1823.55],[2,"KSA",536760.0,57765.25],[2,"Bahrain",37924.8,1627.2],[2,"Kuwait",6670.13,479.13],[2,"UAE",226629.0,11013.81],[2,"French Africa",4296.0,433.51],[1,"KSA",1408213.0,87510.45],[1,"French Africa",120050.0,16116.32],[1,"Kuwait",5791.5,407.5],[1,"Arabic Africa",36886.5,5528.25],[1,"Oman",14875.0,323.05]],"2025":[[12,"Bahrain",101449.54,8802.76],[12,"French Africa",67011.95,6045.02],[12,"KSA",2467964.0,261020.14],[12,"Oman",171385.8,13851.03],[12,"Qatar",114851.12,6775.97],[12,"UAE",174398.06,13599.6],[12,"Kuwait",45946.0,3294.5],[12,"Arabic Africa",159000.0,12684.0],[11,"UAE",161905.22,11048.22],[11,"KSA",807205.0,114027.55],[11,"Kuwait",72200.0,6115.0],[11,"Levant",36856.13,4228.13],[11,"Arabic Africa",82100.0,6470.11],[10,"KSA",238108.0,27038.36],[10,"French Africa",14010.0,1541.13],[10,"Qatar",45126.3,5206.41],[10,"Kuwait",23542.62,2115.62],[10,"UAE",3000.0,1740.0],[9,"Kuwait",11237.8,634.8],[9,"UAE",587428.22,30922.48],[9,"KSA",1227294.0,61821.79],[9,"Arabic Africa",146927.79,10326.8],[9,"Levant",141047.0,16517.18],[9,"Bahrain",300970.0,17286.73],[9,"French Africa",227678.0,23144.87],[8,"KSA",981307.0,59003.56],[8,"UAE",185981.63,12126.92],[8,"French Africa",33550.0,4609.26],[8,"Qatar",101265.49,7102.85],[7,"KSA",431957.0,32371.34],[7,"UAE",116000.9,5835.83],[7,"Bahrain",61601.0,4397.99],[7,"Levant",4190.0,970.0],[7,"Oman",22953.0,2012.0],[7,"Kuwait",40200.0,4200.0],[7,"Western Africa",99000.0,7000.0],[6,"Arabic Africa",34710.0,3010.0],[6,"Kuwait",5325.0,479.0],[6,"Levant",6355.0,635.0],[5,"French Africa",7262.8,725.8],[5,"KSA",572531.0,28649.76],[5,"UAE",4467.8,897.8],[4,"KSA",159496.0,16461.09],[4,"Qatar",97172.5,7638.5],[4,"Arabic Africa",-36886.5,-5529.29],[4,"French Africa",20551.0,2045.11],[4,"UAE",840.37,1082.78],[3,"UAE",36171.59,3606.59],[3,"Arabic Africa",100877.5,10519.5],[3,"Levant",188837.76,9463.89],[3,"KSA",36323.0,1973.74],[3,"Bahrain",16306.85,1156.03],[3,"Kuwait",90660.0,6160.01],[2,"Arabic Africa",36886.5,5528.25],[2,"UAE",27800.0,1986.0],[1,"KSA",1633062.0,101268.57]],"2024":[[12,"KSA",914079.0,52252.89],[12,"Arabic Africa",435512.5,28943.5],[12,"UAE",252120.24,13839.24],[12,"Oman",13300.0,800.0],[12,"Kuwait",21500.0,1413.5],[12,"French Africa",12537.54,893.54],[11,"Kuwait",40001.5,303.5],[11,"UAE",25250.4,3796.4],[10,"KSA",39014.0,5580.03],[10,"Oman",367288.0,30117.33],[10,"Bahrain",202000.0,12800.0],[9,"Bahrain",61998.0,3456.0],[9,"KSA",867056.0,45974.18],[9,"Kuwait",18864.0,4706.0],[9,"UAE",46428.59,3012.59],[9,"Qatar",101265.49,7102.85],[8,"KSA",533186.0,43048.59],[7,"Arabic Africa",31023.0,3063.0],[7,"UAE",76019.62,5316.62],[7,"Bahrain",40174.0,2633.52],[7,"Kuwait",3275.0,275.0],[7,"Levant",5750.0,550.0],[6,"KSA",422834.0,29002.94],[6,"Bahrain",30638.1,2142.1],[5,"Qatar",93609.0,10098.0],[5,"KSA",985509.0,62918.78],[5,"Levant",141047.0,21517.18],[3,"Kuwait",67666.39,6696.39],[3,"Levant",6858.9,1072.9]]},"Solarwinds":{"2026":[[8,"KSA",18353.0,2840.53],[8,"Arabic Africa",37380.7,2620.7],[7,"UAE",34348.3,3838.97],[7,"Qatar",7879.58,1627.71],[7,"KSA",56851.0,6586.54],[7,"Arabic Africa",49833.36,6909.36],[7,"Levant",84697.0,12549.0],[6,"UAE",116166.99,21472.92],[6,"KSA",1072172.0,154849.65],[6,"Kuwait",72891.81,10142.81],[6,"Qatar",146240.95,27383.64],[6,"Levant",5067.33,979.83],[5,"Levant",136151.19,19880.99],[5,"Kuwait",14170.48,1572.48],[5,"Arabic Africa",103561.45,25078.45],[5,"KSA",354897.0,37603.28],[5,"Qatar",5107.8,754.8],[5,"UAE",117177.0,13740.48],[4,"KSA",1134083.0,183160.15],[4,"UAE",72959.0,1730.21],[4,"Qatar",103615.81,21682.54],[4,"Bahrain",16048.05,2276.05],[3,"KSA",129663.0,17555.46],[3,"Levant",61251.26,8246.26],[3,"Rest of the world",264887.6,37023.6],[3,"UAE",78437.82,9815.82],[3,"Kuwait",40110.79,8577.77],[3,"Qatar",6410.51,641.51],[3,"Arabic Africa",4113.0,617.0],[2,"KSA",505924.4,76325.35],[2,"UAE",165684.54,28490.96],[2,"Levant",216640.6,39221.6],[2,"Kuwait",115073.62,21369.73],[1,"Arabic Africa",27039.89,2812.31],[1,"KSA",173226.0,26462.22],[1,"Levant",2337.92,1545.92],[1,"UAE",32755.0,7666.0]],"2025":[[12,"KSA",1735570.0,241027.01],[12,"UAE",591682.49,86161.4],[12,"Kuwait",83307.95,8172.95],[12,"Qatar",48127.83,5681.97],[12,"Arabic Africa",55346.0,10236.16],[12,"Levant",72586.86,3629.3],[12,"Rest of the world",2863.3,429.54],[11,"KSA",98434.8,25964.61],[11,"UAE",141096.84,15493.84],[11,"Qatar",15689.52,1138.58],[11,"Kuwait",8500.0,1012.0],[11,"Bahrain",10419.6,1515.6],[11,"Oman",41517.26,4427.26],[11,"Levant",13022.26,1302.26],[10,"KSA",916159.0,139431.21],[10,"UAE",51729.97,7163.97],[10,"Qatar",22327.34,2277.74],[10,"Levant",23309.68,2621.68],[10,"Arabic Africa",172210.31,26227.31],[9,"KSA",1062109.0,140008.42],[9,"UAE",95104.82,13191.82],[9,"Qatar",25592.1,3765.1],[9,"Oman",32759.0,10800.0],[8,"UAE",467053.32,51363.32],[8,"KSA",214624.0,32730.88],[8,"Oman",43580.0,4478.0],[8,"Rest of the world",14770.0,2160.0],[8,"Bahrain",24888.7,2488.7],[8,"Kuwait",105000.22,13230.22],[7,"KSA",803133.0,77781.01],[7,"Levant",57383.94,4591.94],[7,"UAE",79513.32,7807.32],[7,"Arabic Africa",18250.76,6728.76],[7,"Qatar",50122.08,2887.08],[6,"KSA",699853.0,105255.5],[6,"UAE",163949.27,13006.87],[6,"Qatar",67333.43,5414.85],[6,"Kuwait",24437.82,6787.82],[5,"KSA",481478.23,62625.91],[5,"Levant",69939.43,7087.38],[5,"Kuwait",7320.8,1372.65],[5,"UAE",38444.58,3484.58],[5,"Qatar",70000.0,19821.59],[4,"KSA",35763.0,5986.24],[4,"UAE",27926.12,1459.12],[4,"Oman",36928.0,8946.25],[4,"Qatar",37392.61,2650.61],[4,"Levant",13419.54,1341.54],[3,"UAE",113907.65,11753.65],[3,"KSA",651995.0,96180.01],[3,"Kuwait",-39630.05,-1045.54],[3,"Qatar",5243.34,275.34],[2,"KSA",445814.0,73751.66],[2,"Qatar",25000.0,5293.0],[2,"Kuwait",19284.59,2377.13],[2,"UAE",40036.04,5512.04],[1,"KSA",225426.0,47904.99],[1,"UAE",25426.92,1494.92],[1,"Levant",16512.63,1535.63],[1,"Kuwait",8927.81,828.81]],"2024":[[12,"KSA",1338225.0,161282.23],[12,"UAE",101139.94,8755.94],[12,"Kuwait",109347.14,14077.14],[12,"Qatar",3718.21,354.21],[12,"Levant",21659.5,3774.5],[11,"UAE",149983.0,20725.44],[11,"KSA",710236.0,119485.33],[11,"Levant",18755.51,1014.51],[11,"Kuwait",186681.75,12145.1],[11,"Qatar",57823.62,8998.62],[10,"UAE",225423.38,32232.19],[10,"KSA",204042.14,30060.45],[10,"Kuwait",85381.35,5939.35],[10,"Levant",12262.5,1362.5],[9,"KSA",285372.29,44932.94],[9,"Qatar",612.9,114.9],[9,"UAE",82236.15,16777.15],[9,"Levant",16000.0,3000.0],[9,"Kuwait",10000.0,686.0],[8,"KSA",512748.0,77431.23],[8,"UAE",78269.65,11675.65],[8,"Qatar",48945.85,5500.85],[8,"Levant",5750.0,1050.0],[7,"KSA",353293.0,36016.84],[7,"UAE",75872.52,7726.52],[7,"Qatar",45509.57,3842.57],[7,"Kuwait",27915.0,3413.0],[6,"KSA",369131.7,49096.94],[6,"UAE",92067.19,13595.04],[6,"Qatar",106497.15,4809.15],[6,"Kuwait",329.0,72.0],[5,"KSA",268606.0,8383.93],[5,"Levant",65087.92,5490.92],[5,"UAE",33110.81,2233.81],[4,"UAE",25260.82,1278.82],[4,"KSA",259548.0,30718.99],[4,"Kuwait",110210.8,14487.8],[3,"UAE",58900.32,4052.44],[3,"KSA",533636.0,48057.81],[3,"Kuwait",4802.0,788.0],[3,"Qatar",31502.54,1598.76],[2,"KSA",444479.0,66912.75],[2,"Qatar",34140.0,1058.0],[2,"UAE",38163.62,3531.62],[1,"Kuwait",26195.48,2202.24],[1,"KSA",276692.0,32653.59],[1,"UAE",50816.0,5421.0],[1,"Qatar",173112.68,18820.0]]},"TXOne":{"2026":[[8,"Levant",22653.0,3703.0],[7,"UAE",10351.99,1360.99],[7,"KSA",37424.0,8643.38],[6,"UAE",1257.45,-902.55],[6,"Oman",62213.8,6157.8],[6,"Southern Africa",90113.0,19983.39],[6,"Qatar",2499.99,249.99],[6,"KSA",91949.0,7190.57],[6,"French Africa",4024.08,546.08],[5,"Rest of the world",40384.45,2691.82],[4,"Southern Africa",73197.72,16415.69],[4,"Arabic Africa",11184.0,1343.0],[4,"Levant",17678.5,2827.51],[4,"Qatar",77001.18,6031.27],[3,"KSA",27776.0,4152.95],[3,"Oman",7680.0,414.0],[3,"Qatar",26829.5,1829.36],[3,"Arabic Africa",23200.0,2400.0],[1,"UAE",111412.0,21528.96]],"2025":[[11,"KSA",17004.0,4175.23],[11,"UAE",940.0,940.0],[11,"Arabic Africa",4950.0,369.95],[10,"French Africa",3818.0,1395.29],[10,"KSA",9779.0,693.36],[10,"Rest of the world",1100.0,100.0],[10,"Levant",4370.0,770.61],[9,"Bahrain",68520.0,14510.33],[9,"Southern Africa",78400.0,15200.0],[9,"Oman",72000.0,7680.0],[9,"UAE",1050.0,100.0],[8,"Oman",87212.0,5000.0],[8,"Rest of the world",63512.0,12742.27],[7,"Levant",20950.0,6848.24],[5,"UAE",3300.0,217.31],[1,"KSA",81820.0,5042.51],[1,"Oman",2865.0,-342.65]],"2024":[[12,"KSA",179282.0,26965.54],[11,"Oman",12304.8,565.91],[10,"KSA",2780.0,279.8],[10,"UAE",6690.13,472.87],[8,"UAE",16362.0,1818.0],[7,"KSA",7351.0,939.01]]},"Security Scorecard":{"2026":[[8,"Levant",23191.9,1854.9],[8,"Qatar",24130.68,1130.82],[7,"UAE",79270.0,5888.0],[6,"Oman",41250.0,5858.0],[6,"Kuwait",17256.67,2590.0],[6,"UAE",25500.01,2295.14],[6,"Levant",34999.6,2799.6],[6,"KSA",253500.0,25500.32],[5,"Qatar",35861.78,1861.78],[4,"KSA",49902.0,401.38],[4,"Kuwait",60976.0,4876.0],[3,"KSA",37000.0,8081.33],[2,"UAE",15542.1,1554.1]],"2025":[[12,"KSA",0.0,0.99],[12,"UAE",17476.75,11476.75],[12,"Qatar",10534.9,1034.83],[12,"Kuwait",5435.5,435.5],[11,"Kuwait",11235.95,1235.95],[10,"KSA",57912.0,5912.01],[10,"UAE",128229.66,10806.66],[10,"Oman",34252.25,4280.25],[9,"Rest of the world",54800.0,4600.0],[9,"UAE",9774.7,508.7],[9,"Bahrain",15833.3,833.3],[9,"Arabic Africa",12512.52,1262.52],[9,"Kuwait",16469.55,2653.55],[7,"KSA",-66847.0,-6633.36],[7,"Qatar",42321.42,3321.29],[6,"UAE",128754.99,7084.99],[6,"Qatar",-71723.56,-3723.56],[6,"Levant",34999.6,2799.6],[5,"Qatar",107585.34,5585.07],[5,"KSA",53206.0,3206.37],[4,"UAE",21392.0,1409.0],[4,"KSA",282000.0,28650.59],[3,"Arabic Africa",14000.0,850.0],[3,"UAE",9000.0,516.0],[3,"Levant",22092.95,1771.95],[2,"Bahrain",47368.0,2368.0],[2,"KSA",54044.0,2718.0],[1,"French Africa",24867.0,1867.11],[1,"KSA",147831.0,6980.0]],"2024":[[12,"KSA",349312.0,33611.96],[12,"Qatar",10534.0,534.0],[12,"UAE",135756.56,10269.56],[12,"Kuwait",16430.0,1430.0],[11,"Levant",-102698.35,-1215.3],[10,"Arabic Africa",14500.0,3250.0],[10,"Bahrain",15833.4,833.4],[10,"UAE",9309.5,484.5],[9,"Kuwait",16371.0,2637.0],[8,"Oman",34550.0,4355.0],[7,"UAE",76542.32,4242.32],[7,"Qatar",41610.8,2610.8],[7,"Levant",16579.55,829.55],[6,"KSA",54000.0,2850.07],[6,"UAE",8851.99,482.99],[5,"UAE",21177.4,1194.4],[5,"Kuwait",23250.0,6250.0],[3,"Levant",237976.46,12974.47],[3,"UAE",336460.1,27279.1],[3,"Bahrain",47368.5,2368.5],[2,"KSA",23095.0,1164.94],[1,"French Africa",24886.0,1886.22],[1,"UAE",7492.1,799.1]]},"Arista":{"2026":[[8,"Southern Africa",44557.0,5659.88],[7,"UAE",102731.17,9063.95],[7,"KSA",130065.0,12842.77],[7,"Southern Africa",223646.09,16067.53],[7,"Kuwait",29440.0,5471.74],[6,"UAE",24412.67,2155.47],[6,"Southern Africa",108363.12,10337.23],[6,"Bahrain",1034066.07,59719.88],[6,"KSA",1641232.0,158957.06],[5,"Kuwait",3391.62,559.62],[5,"Levant",1062816.52,232565.09],[5,"KSA",1590.0,124.22],[5,"Southern Africa",46616.89,3606.93],[5,"UAE",14050.43,858.11],[4,"Southern Africa",322456.44,14596.69],[4,"KSA",27317.0,1908.75],[3,"KSA",16768.0,3121.22],[3,"Qatar",20432.18,11780.16],[3,"UAE",5873460.54,362669.75],[3,"Southern Africa",123150.06,13543.81],[2,"KSA",267239.0,44035.59],[2,"Kuwait",5650.0,1875.58],[2,"Arabic Africa",402251.04,16635.04],[2,"UAE",1893.5,381.14],[2,"Levant",22580.18,2713.18],[1,"Qatar",3037.59,494.49],[1,"UAE",31743.24,2579.7]],"2025":[[12,"UAE",442616.18,35575.28],[12,"KSA",372128.0,33883.91],[12,"Southern Africa",405738.22,39838.19],[12,"Levant",4560.0,1213.28],[11,"KSA",129313.0,8133.06],[11,"Rest of the world",99952.68,19507.46],[10,"UAE",620510.09,57091.59],[10,"KSA",1225759.0,83917.21],[10,"Levant",3378.47,-110.63],[10,"Qatar",26508.0,1821.42],[9,"UAE",429795.69,34509.49],[9,"Levant",26749.0,3110.03],[9,"KSA",40580.0,8148.22],[9,"Southern Africa",27705.81,2629.94],[8,"UAE",59645.38,7237.52],[8,"Southern Africa",50826.21,4421.0],[8,"Rest of the world",10051.0,2884.59],[8,"KSA",25750.0,3161.06],[8,"Arabic Africa",107000.1,10000.1],[8,"Kuwait",702.0,114.0],[7,"UAE",25066.2,2293.28],[7,"Qatar",1006959.52,115893.52],[7,"KSA",267698.0,26421.83],[7,"Southern Africa",5900.69,724.17],[6,"UAE",445037.01,46854.15],[6,"KSA",82503.0,20559.67],[6,"Southern Africa",2801.54,195.31],[5,"Bahrain",232730.44,73570.58],[5,"KSA",19780.0,1780.37],[5,"UAE",118595.18,7715.7],[5,"Levant",3129.0,1682.27],[4,"UAE",170795.0,39108.47],[4,"KSA",7189.0,1459.46],[4,"Levant",7430.4,924.4],[3,"KSA",289618.0,28396.49],[3,"Southern Africa",85064.5,5954.5],[3,"UAE",36919.0,4269.38],[2,"UAE",102695.73,10229.88],[1,"KSA",119295.0,11890.09],[1,"Levant",25000.0,2829.0],[1,"Bahrain",289313.29,25811.23],[1,"UAE",28750.02,3342.94]],"2024":[[12,"UAE",212718.39,22381.75],[12,"KSA",261983.0,41360.47],[11,"Bahrain",-0.01,-869.2],[11,"Qatar",9910.0,409.71],[11,"UAE",2463.45,-26110.23],[11,"KSA",1968.0,268.44],[10,"Kuwait",59882.0,3078.03],[10,"KSA",241718.0,21524.09],[10,"UAE",188981.08,17564.16],[9,"UAE",73322.4,8567.23],[9,"Kuwait",321722.6,43316.69],[8,"KSA",76748.0,7863.15],[8,"UAE",46120.0,46120.0],[7,"Levant",4800.0,681.6],[7,"UAE",14744.52,2171.49],[7,"KSA",239188.0,20587.2],[6,"Levant",242737.35,22139.21],[6,"UAE",6107394.44,532637.46],[6,"Bahrain",1785.0,25.76],[5,"Bahrain",2610686.95,164030.01],[5,"UAE",93590.78,11502.57],[5,"Levant",29828.0,3015.98],[5,"Kuwait",408045.3,83750.13],[4,"UAE",279660.4,31872.22],[4,"KSA",13322.0,1340.37],[3,"UAE",4634.94,476.94],[3,"Levant",491462.52,24045.86],[2,"UAE",101883.29,-5237.8],[2,"Qatar",21681.26,5899.26],[2,"Bahrain",669739.54,55743.45],[1,"KSA",59000.0,7560.34],[1,"UAE",215076.13,26472.02]]},"Netwrix":{"2026":[[8,"KSA",164911.0,56101.07],[7,"Arabic Africa",406537.22,56915.22],[7,"KSA",33015.0,9949.51],[7,"UAE",4726.46,933.46],[7,"Levant",34999.07,7594.07],[7,"Qatar",5735.85,1479.89],[7,"Kuwait",89310.0,23925.29],[6,"Oman",27121.03,4339.03],[6,"Levant",17245.0,4360.0],[6,"Arabic Africa",19694.64,4332.64],[6,"UAE",44830.45,5966.4],[5,"Arabic Africa",336273.0,52417.04],[5,"UAE",11209.3,2249.3],[5,"Levant",3953.26,593.26],[5,"French Africa",15569.08,2794.08],[4,"Levant",11289.81,2411.81],[4,"Arabic Africa",101868.65,29129.65],[4,"KSA",-17764.0,1472.32],[4,"UAE",168416.91,28662.91],[4,"Kuwait",36796.68,4135.68],[4,"Bahrain",6747.73,2968.73],[3,"UAE",29121.13,348.91],[3,"Levant",172167.52,18593.52],[3,"KSA",21334.0,7834.17],[2,"UAE",13035.16,3347.01],[2,"Bahrain",3168.0,1046.0],[2,"Levant",4269.54,1004.54],[2,"KSA",123407.0,24680.75],[2,"Arabic Africa",2769.3,-62210.02],[1,"UAE",43163.4,8758.55],[1,"Bahrain",11375.88,3297.88]],"2025":[[12,"UAE",216275.92,29496.01],[12,"Qatar",121465.42,65969.24],[12,"Arabic Africa",142843.94,37835.01],[12,"KSA",141193.0,53462.8],[12,"Bahrain",34590.22,4302.22],[12,"Levant",16023.31,2243.31],[11,"UAE",37923.6,7681.75],[11,"Oman",36080.73,3262.97],[11,"Kuwait",14489.96,2365.96],[11,"French Africa",16882.38,3330.38],[11,"Levant",15691.38,4282.38],[10,"Arabic Africa",56730.74,18810.71],[10,"UAE",41479.76,4628.49],[10,"Levant",9600.0,1551.0],[10,"KSA",54113.0,12045.61],[10,"Qatar",4066.1,285.1],[10,"Bahrain",3971.56,873.56],[9,"KSA",9740.0,2398.15],[9,"French Africa",960.0,115.0],[9,"UAE",88387.09,14407.09],[9,"Bahrain",3778.2,1322.2],[9,"Arabic Africa",5520.0,654.0],[8,"Arabic Africa",38666.6,8666.62],[8,"UAE",10483.66,1719.66],[8,"Levant",15775.9,4732.9],[8,"Kuwait",89310.0,23925.37],[8,"Bahrain",4728.28,895.28],[8,"Qatar",19052.0,9524.0],[7,"Qatar",33907.65,13034.65],[7,"KSA",-55498.0,-10470.66],[7,"UAE",108377.32,13298.86],[7,"Arabic Africa",23580.0,3580.0],[7,"Levant",8502.4,1614.4],[6,"KSA",159000.0,45029.36],[6,"Oman",22650.0,3153.0],[6,"UAE",1341.0,162.0],[5,"Arabic Africa",17150.2,3434.2],[5,"KSA",246376.0,96375.64],[5,"UAE",334.68,51.68],[5,"Qatar",887.0,246.0],[5,"Levant",10000.5,1999.5],[4,"UAE",125683.12,23385.12],[4,"Qatar",4920.18,984.18],[4,"KSA",29840.0,5071.67],[4,"Arabic Africa",23315.76,5053.76],[4,"Bahrain",9300.0,2551.0],[4,"Levant",32791.83,4316.83],[3,"Levant",212668.35,25921.35],[3,"UAE",66127.54,8330.54],[3,"Qatar",221536.0,52827.41],[3,"KSA",55774.0,11597.48],[2,"Kuwait",11510.0,1835.0],[2,"UAE",147644.53,21361.22],[2,"Arabic Africa",59187.75,13417.75],[2,"Levant",38055.0,4693.0],[2,"KSA",34500.0,4341.67],[2,"Oman",16800.0,1393.25],[1,"Kuwait",2000.1,243.6],[1,"Levant",7770.0,1170.0],[1,"KSA",31446.0,4757.8],[1,"UAE",9090.8,1090.8]],"2024":[[12,"UAE",67428.82,16185.04],[12,"Arabic Africa",18515.0,3548.0],[12,"Levant",17549.84,3769.84],[12,"Bahrain",27813.5,5212.5],[12,"Qatar",3862.5,226.5],[12,"Kuwait",11018.15,1762.15],[12,"Oman",7360.0,2129.0],[11,"KSA",262168.7,60530.99],[11,"Oman",18226.43,2087.43],[11,"UAE",29501.83,4188.74],[11,"Kuwait",31375.0,6040.0],[11,"Bahrain",3379.5,613.5],[10,"Oman",25276.3,4549.3],[10,"UAE",35230.55,5072.55],[10,"Bahrain",33737.8,5380.8],[10,"KSA",83827.0,18486.8],[9,"KSA",32771.0,8553.53],[9,"UAE",47537.82,9978.82],[9,"Kuwait",60136.5,12259.0],[9,"Arabic Africa",89366.6,16466.6],[9,"Levant",28044.5,9340.08],[8,"French Africa",960.0,110.0],[8,"KSA",614722.0,153722.24],[8,"Levant",26132.0,5779.69],[8,"Qatar",12977.0,4471.0],[8,"UAE",23034.0,1608.0],[8,"Kuwait",3925.0,777.0],[8,"Oman",43922.87,5498.87],[7,"Levant",133591.14,16054.14],[7,"Kuwait",89310.0,23925.37],[6,"Oman",21319.5,2630.93],[6,"Kuwait",115900.56,17360.9],[6,"Qatar",20021.48,2748.48],[5,"Arabic Africa",24226.9,4364.8],[5,"KSA",38709.0,5089.74],[5,"UAE",87236.54,12926.09],[4,"Levant",17135.21,3436.21],[4,"KSA",29511.0,4743.19],[4,"Arabic Africa",2469.0,370.0],[3,"UAE",1495.55,222.55],[3,"Qatar",520352.0,154434.83],[3,"Arabic Africa",7635.0,1460.0],[3,"Levant",10134.8,1792.8],[3,"Bahrain",5774.0,930.0],[3,"Kuwait",33250.0,4090.0],[3,"KSA",3335.0,-1681.94],[2,"Levant",210000.0,25200.0],[2,"Bahrain",32829.0,6439.0],[2,"Oman",16800.0,1393.25],[2,"UAE",15546.77,1834.77],[2,"KSA",645.0,65.29],[1,"Levant",16251.62,3250.62],[1,"UAE",33156.44,3329.44],[1,"Bahrain",2983.5,440.5],[1,"KSA",1083.0,216.0]]},"Lookout":{"2026":[[7,"KSA",986111.0,66730.96],[7,"French Africa",1400.0,203.0],[7,"UAE",4057.22,609.22],[6,"Eastern Africa",9338.0,933.92],[4,"Southern Africa",5466.08,-1531.03],[4,"UAE",994.96,128.96],[3,"Southern Africa",91268.14,10331.17],[2,"KSA",14820.0,1779.04]],"2025":[[12,"Qatar",64064.0,5564.01],[11,"Southern Africa",3735.0,561.0],[11,"UAE",300.0,48.0],[10,"Bahrain",1890.0,190.0],[8,"KSA",114075.0,8025.31],[7,"UAE",82767.36,8865.36],[6,"French Africa",1330.0,133.0],[6,"Eastern Africa",11004.67,1100.62],[6,"KSA",178650.0,12550.29],[5,"KSA",704001.0,46000.88],[4,"Levant",654495.94,81073.02],[4,"UAE",900.07,91.07],[3,"Bahrain",1867.0,250.0],[3,"Southern Africa",2252.25,225.25],[1,"Levant",66325.0,8334.0],[1,"Qatar",81109.0,6063.8]],"2024":[[11,"Levant",68592.0,10968.0],[11,"UAE",20667.7,1672.7],[10,"UAE",38694.5,3873.5],[9,"KSA",213331.0,16802.47],[8,"UAE",22600.0,2600.0],[4,"Levant",649995.94,80227.06],[4,"KSA",704001.0,46000.76],[3,"UAE",6069.04,939.04],[2,"Levant",21262.5,2551.5],[2,"UAE",49986.0,4030.0],[1,"KSA",13750.0,3545.0],[1,"French Africa",1360.0,163.0]]},"Minio":{"2026":[[7,"KSA",46452.0,3251.79],[6,"KSA",1220721.0,86121.52],[5,"KSA",76800.0,4608.1],[4,"KSA",77419.0,5418.77],[4,"French Africa",47980.0,3370.0],[1,"KSA",253148.0,18973.63]],"2025":[[12,"UAE",86000.0,6020.0],[12,"KSA",52174.0,7534.04],[11,"UAE",43009.94,3009.94],[9,"KSA",25807.0,1807.03],[8,"UAE",46093.94,3433.94],[7,"KSA",46464.0,3264.06],[6,"KSA",1095127.0,77166.86],[6,"Southern Africa",44640.0,2232.0],[4,"KSA",51600.0,3600.06],[3,"KSA",287001.0,20273.02]]},"Forescout":{"2026":[[7,"KSA",66376.0,3982.93],[7,"UAE",13405.99,801.99],[7,"Western Africa",17622.5,2517.5],[6,"Kuwait",80366.37,4018.37],[6,"Western Africa",154628.04,16715.04],[6,"Arabic Africa",25001.0,5001.0],[5,"Bahrain",108779.84,6275.84],[5,"KSA",171979.0,12419.54],[5,"Arabic Africa",30983.07,3160.07],[3,"KSA",269038.0,13575.6],[3,"Bahrain",29378.4,2060.4],[3,"UAE",5666.99,470.99],[2,"UAE",42950.74,3276.74],[2,"KSA",-5921.0,6286.3],[1,"KSA",49932.0,5322.45],[1,"Eastern Africa",85972.49,5544.8]],"2025":[[12,"Arabic Africa",108373.0,9980.0],[12,"KSA",326765.0,20764.63],[12,"Levant",4855.41,485.41],[12,"UAE",8730.61,523.61],[12,"French Africa",0.0,583.14],[12,"Bahrain",8119.9,568.9],[11,"KSA",834203.0,71319.93],[11,"Arabic Africa",62499.94,5536.94],[11,"Bahrain",48725.97,4872.97],[10,"French Africa",58056.09,4434.49],[10,"KSA",485601.0,109570.33],[9,"KSA",739362.0,160705.72],[9,"Bahrain",19259.13,1376.13],[9,"Arabic Africa",264999.0,29744.0],[8,"KSA",126082.0,9063.58],[8,"UAE",12676.96,673.96],[6,"Bahrain",33650.46,2017.46],[6,"Arabic Africa",14600.0,657.0],[6,"KSA",124105.0,7544.33],[6,"French Africa",108102.27,11058.27],[5,"KSA",46790.0,2542.46],[5,"Bahrain",74585.95,4351.95],[5,"French Africa",28783.0,3998.0],[4,"KSA",23408.0,1514.96],[4,"UAE",30013.93,1872.42],[3,"KSA",246334.0,16082.5],[3,"UAE",6070.14,247.14],[2,"KSA",356899.0,33184.41],[2,"UAE",3219.06,322.06],[1,"KSA",184432.0,14759.79],[1,"Arabic Africa",15800.0,-1904.13]],"2024":[[12,"KSA",1447501.0,123547.55],[11,"KSA",33351.0,2360.65],[11,"Oman",28393.48,4697.48],[11,"Bahrain",5310.0,418.0],[11,"UAE",41836.36,3686.36],[9,"KSA",26614.0,1731.4],[8,"KSA",132470.0,10793.38],[7,"French Africa",50081.0,8356.29]]},"Accuknox":{"2026":[[7,"UAE",5786.25,1031.25],[6,"UAE",49436.9,4946.9]],"2025":[[8,"UAE",22500.0,2500.0]]},"Entrust":{"2026":[[7,"Qatar",13920.34,1526.33],[7,"Eastern Africa",118000.0,16644.16],[7,"KSA",174407.0,17296.64],[7,"Arabic Africa",775.0,194.0],[6,"UAE",98205.64,9855.64],[6,"KSA",232792.0,2059.66],[6,"Southern Africa",179926.0,30382.91],[5,"UAE",5211.71,426.71],[5,"Bahrain",1181.74,117.74],[5,"KSA",181667.0,6822.68],[5,"Western Africa",11111.61,1444.61],[5,"Levant",34059.33,5449.33],[4,"KSA",1144446.0,197632.15],[4,"Qatar",39646.29,4576.29],[4,"UAE",28297.02,4698.02],[3,"KSA",1166159.0,80508.5],[3,"Arabic Africa",119436.25,4313.81],[3,"UAE",32340.76,3820.62],[3,"Bahrain",14403.18,2736.18],[3,"Levant",3274.42,393.42],[3,"Rest of the world",1302.28,285.11],[2,"UAE",28841.92,1497.92],[2,"Bahrain",46795.39,12616.39],[2,"KSA",311336.0,35807.19],[2,"Arabic Africa",218511.18,22623.51],[2,"Levant",129169.51,18083.74],[2,"Qatar",5840.75,1176.04],[1,"KSA",967501.0,90312.02],[1,"Rest of the world",2879.74,431.74],[1,"Qatar",624.26,62.26]],"2025":[[12,"Bahrain",204490.76,10504.94],[12,"KSA",291407.0,-12464.39],[12,"Qatar",27572.01,3860.01],[12,"Levant",123943.79,14240.95],[11,"KSA",231088.0,67328.35],[11,"UAE",54745.41,5854.41],[11,"Arabic Africa",23106.32,2306.32],[11,"Bahrain",7565.46,832.46],[11,"Levant",2410.0,240.99],[11,"Qatar",2004.88,300.74],[10,"KSA",106887.0,6353.62],[10,"Eastern Africa",40739.57,14577.9],[10,"Levant",34032.73,4678.37],[10,"UAE",34173.28,2275.52],[10,"Bahrain",5789.65,868.65],[9,"UAE",771174.0,30921.27],[9,"KSA",244061.0,91177.05],[8,"KSA",181367.0,28674.0],[8,"Qatar",32064.38,10978.38],[8,"UAE",90456.0,10113.29],[7,"KSA",-7074.0,11489.61],[6,"KSA",679019.0,56468.84],[6,"UAE",23828.95,3811.95],[6,"Eastern Africa",0.0,11918.23],[5,"Levant",30529.32,4579.32],[4,"KSA",229038.0,47370.81],[4,"UAE",35818.33,5132.09],[4,"Bahrain",40420.92,9039.92],[4,"Arabic Africa",42944.0,3944.0],[3,"Arabic Africa",261055.22,19814.22],[3,"KSA",53685.0,9733.06],[3,"Levant",3015.69,271.69],[3,"Qatar",24511.64,3270.64],[3,"UAE",190.06,21.06],[2,"Bahrain",36518.33,5934.33],[2,"KSA",94755.0,10361.17],[2,"Arabic Africa",21643.29,2285.29],[1,"KSA",347725.0,72808.96],[1,"Qatar",599.08,64.08],[1,"Levant",3348.25,301.25]],"2024":[[12,"KSA",88727.0,14893.42],[12,"Bahrain",7125.2,712.2],[11,"Eastern Africa",244946.45,17532.97],[11,"UAE",77142.67,46965.9],[11,"Qatar",83608.17,10511.18],[11,"KSA",44757.0,13426.08],[11,"Bahrain",3940.6,311.6],[10,"KSA",223612.0,18275.04],[10,"UAE",167553.02,15407.91],[10,"Bahrain",9589.86,1369.86],[9,"UAE",881141.12,41938.42],[9,"Qatar",156944.04,12677.42],[9,"KSA",1779.0,267.8],[9,"Arabic Africa",18132.07,3626.07],[8,"KSA",134773.0,15322.58],[8,"Bahrain",14960.5,3349.5],[8,"Arabic Africa",500.0,61.0],[7,"KSA",135350.0,9795.11],[6,"KSA",263032.0,34791.32],[6,"Arabic Africa",134070.2,11566.2],[6,"Qatar",304708.07,31359.95],[6,"UAE",22108.2,1789.2],[5,"KSA",287406.0,30677.15],[5,"Arabic Africa",1400.0,170.0],[5,"Qatar",399014.68,58279.96],[4,"KSA",299837.0,29786.04],[4,"Bahrain",12100.0,1050.0],[4,"UAE",290.0,173.3],[4,"Levant",2904.0,290.0],[4,"Kuwait",36304.75,5189.55],[3,"Qatar",588.0,78.0],[3,"Bahrain",38441.9,8576.9],[3,"UAE",5288.25,530.25],[3,"KSA",0.0,10.41],[2,"UAE",11330.95,2426.37],[2,"Qatar",110000.0,7900.0],[2,"KSA",55639.0,5589.14],[2,"Bahrain",53624.0,8114.85],[2,"Levant",3223.53,321.53],[2,"Arabic Africa",1275.0,192.0],[1,"KSA",435469.0,45078.69],[1,"Qatar",165205.23,21107.23]]},"Harness":{"2026":[[7,"Western Africa",55946.66,5594.66],[6,"KSA",131000.0,10004.47],[3,"UAE",50532.46,3032.46],[2,"UAE",203237.73,8160.96],[2,"KSA",212436.0,49033.83]],"2025":[[12,"UAE",373883.83,52133.83],[11,"UAE",40000.0,4000.0],[10,"KSA",76000.0,6399.98]]},"Cribl":{"2026":[[7,"UAE",147840.0,13440.0],[7,"Kuwait",268444.49,34534.35],[7,"Qatar",41170.7,2576.83],[3,"Qatar",5360.81,360.68]],"2025":[[12,"UAE",262405.17,13330.19],[12,"KSA",114920.0,17239.27],[10,"KSA",273750.0,29375.39],[9,"Rest of the world",40315.0,2015.0],[8,"KSA",394431.0,39528.25],[6,"Qatar",41432.88,2839.0]],"2024":[[9,"KSA",960001.0,83501.27]]},"Exagrid":{"2026":[[7,"Qatar",95633.33,9563.33],[7,"Levant",137577.77,12738.3],[7,"KSA",511130.0,34087.78],[7,"Arabic Africa",81699.94,9698.4],[7,"Oman",13753.65,1187.65],[6,"KSA",-60990.0,-3037.3],[6,"Arabic Africa",831173.88,170413.36],[6,"Levant",21898.0,745.91],[5,"KSA",44232.0,3096.43],[5,"Arabic Africa",82816.68,6580.21],[4,"KSA",53830.0,3289.51],[4,"Arabic Africa",6620.01,1986.01],[4,"Levant",37585.0,3008.0],[4,"Kuwait",169100.0,15445.09],[3,"KSA",291368.0,88103.2],[2,"Arabic Africa",66282.0,7036.5],[1,"Arabic Africa",208806.9,28550.24],[1,"KSA",266667.0,14763.84],[1,"Kuwait",44000.0,2738.5]],"2025":[[12,"Kuwait",157795.0,15840.7],[12,"Arabic Africa",6427.2,1928.2],[12,"KSA",353975.0,-29473.79],[11,"Arabic Africa",94028.9,16374.91],[11,"KSA",517537.0,34240.86],[8,"KSA",76876.0,5330.74],[8,"Arabic Africa",156329.41,20301.18],[7,"KSA",1038341.0,96206.68],[7,"Bahrain",182227.0,8409.01],[6,"KSA",500264.0,27259.69],[6,"Arabic Africa",13663.7,1366.7],[4,"KSA",146986.0,10163.51],[3,"Arabic Africa",-4000.0,-728.4],[2,"Bahrain",171000.0,10355.59],[1,"KSA",947088.0,64201.43],[1,"Arabic Africa",29400.0,6650.0]],"2024":[[12,"KSA",142412.0,5896.73],[10,"Arabic Africa",41135.0,7490.21],[9,"KSA",307891.0,14908.41],[8,"Arabic Africa",268000.0,25995.24],[4,"Arabic Africa",79222.0,9532.0],[4,"KSA",202363.0,11348.76],[2,"UAE",4872.63,252.63]]},"Immersive Labs":{"2026":[[7,"Levant",128500.0,9344.0],[7,"UAE",135628.07,9225.29],[7,"KSA",45333.0,4719.64],[7,"Arabic Africa",32600.0,2585.0],[6,"Rest of the world",21877.8,1749.8],[5,"KSA",308399.0,17334.66],[5,"Kuwait",163001.0,8151.0],[4,"UAE",148740.73,8197.77],[3,"UAE",100123.46,10012.49],[3,"Levant",92000.0,7000.0],[2,"Qatar",23505.29,2709.37],[2,"UAE",126618.18,7590.18],[2,"Kuwait",140479.4,17063.4],[1,"KSA",51200.0,3178.32]],"2025":[[12,"UAE",264846.83,15673.47],[12,"KSA",214195.0,15186.9],[11,"Rest of the world",334836.53,29993.53],[11,"KSA",51734.0,3733.78],[11,"UAE",324999.68,25999.64],[10,"UAE",533120.49,32606.51],[10,"KSA",129333.0,9848.55],[9,"UAE",68808.61,5387.61],[9,"Qatar",1686509.38,74517.49],[9,"KSA",178070.0,10447.96],[8,"KSA",110000.0,10813.22],[8,"Qatar",113921.73,5695.33],[7,"Oman",5591.0,391.0],[6,"KSA",72800.0,4688.18],[6,"Oman",77016.94,11732.94],[6,"Rest of the world",19690.85,1190.85],[4,"KSA",216400.0,11335.33],[3,"KSA",73430.0,4406.42],[3,"UAE",-178303.52,-16394.5],[3,"Rest of the world",65000.0,7001.0],[3,"Qatar",22355.0,1559.0],[1,"KSA",32000.0,1980.9],[1,"UAE",93669.16,4869.17]],"2024":[[12,"UAE",650413.02,45413.02],[12,"KSA",714131.0,174161.38],[12,"Qatar",165822.91,15792.91],[11,"UAE",740084.68,52821.61],[11,"Qatar",-27500.0,-3573.75],[10,"Qatar",16413.0,820.0],[9,"KSA",42778.0,9668.18],[9,"Oman",142003.0,3333.2],[9,"Qatar",141851.72,7148.09],[8,"UAE",30008.17,1508.17],[8,"KSA",58667.0,8221.81],[7,"KSA",61817.0,6800.7],[7,"Qatar",790961.0,90961.0],[5,"UAE",103216.8,5172.05],[4,"KSA",29891.0,2357.06],[3,"Rest of the world",19690.0,1190.0],[3,"Qatar",38436.0,2523.0],[3,"Oman",5591.5,391.5],[3,"Kuwait",86010.0,20989.0],[2,"KSA",77879.0,2441.14]]},"A Secure":{"2026":[[7,"KSA",11500.0,2000.22]]},"GTB Technologies":{"2026":[[7,"KSA",34300.0,7375.02],[7,"Oman",15000.0,5999.86],[6,"UAE",5611.44,1411.44],[6,"KSA",26829.0,4829.26],[5,"Bahrain",10340.0,1340.0],[5,"KSA",71358.0,14270.66],[4,"Oman",25105.0,4281.0],[4,"KSA",14357.0,2157.03],[2,"UAE",8096.75,1051.75],[2,"KSA",3750.0,1482.07]],"2025":[[12,"UAE",3712.48,742.48],[12,"KSA",68285.0,22555.13],[12,"Levant",36000.0,7400.0],[12,"Bahrain",49078.74,8265.74],[11,"Eastern Africa",23850.0,7200.0],[11,"UAE",52888.14,11438.14],[11,"Oman",34485.59,12035.59],[11,"Bahrain",129700.0,23500.0],[10,"UAE",144741.83,28978.83],[10,"KSA",102750.0,22250.54],[10,"Oman",23162.0,4562.0],[9,"KSA",54798.0,8598.69],[9,"Levant",24850.0,4125.0],[8,"Oman",7912.5,1582.5],[8,"KSA",4369.0,728.36],[7,"KSA",82897.0,16307.35],[7,"Oman",26393.0,3143.0],[6,"KSA",8960.0,1159.87],[6,"Oman",-15000.0,-6000.0],[5,"UAE",19466.45,2802.45],[5,"Qatar",5784.0,3784.0],[4,"Oman",85525.12,13275.12],[3,"Bahrain",34375.0,7275.0],[2,"UAE",7643.54,933.54],[1,"KSA",11880.0,1979.94]],"2024":[[12,"UAE",9030.93,-1019.07],[12,"Bahrain",46630.36,9527.36],[12,"KSA",278904.0,60678.79],[11,"KSA",120000.0,30000.15],[10,"UAE",171970.68,61720.68],[9,"Oman",3400.0,4256.52],[8,"KSA",25042.0,7042.26],[7,"KSA",168307.0,40861.96],[7,"Oman",11000.74,3000.74],[6,"Rest of the world",12793.0,4482.0],[6,"Levant",24903.12,4703.12],[5,"KSA",70598.0,23568.0],[4,"KSA",15131.0,6059.2],[3,"Qatar",58377.0,14377.0],[2,"UAE",8928.58,1428.58],[1,"KSA",73988.0,18588.5]]},"CyberKnight Portfolio":{"2026":[[7,"KSA",3600.0,3600.0],[4,"Levant",30550.0,7800.1]],"2025":[[11,"Levant",16450.0,4200.0]]},"Teknologiia":{"2026":[[7,"UAE",8000.0,0.07]]},"Akamai":{"2026":[[7,"French Africa",117010.0,12491.95],[6,"KSA",14646.0,1539.19]],"2025":[[12,"KSA",205649.0,14932.55],[12,"UAE",57486.6,5755.6],[11,"KSA",109656.0,11155.67],[9,"UAE",99783.87,9430.28]]},"Xage":{"2026":[[7,"UAE",36553.28,2509.28],[6,"UAE",82789.82,5789.82],[6,"KSA",599307.0,44106.88],[6,"Qatar",2575.0,1210.25],[5,"Qatar",244284.93,29260.33],[4,"Qatar",507621.91,37041.68],[4,"KSA",182536.0,9386.4],[3,"Oman",92813.0,16762.0],[3,"Levant",22686.3,1134.3],[3,"KSA",11413.0,948.27],[3,"UAE",11852.16,852.16],[2,"KSA",150000.0,-4749.75],[1,"Qatar",0.0,-105402.54],[1,"KSA",143500.0,11480.22]],"2025":[[12,"Oman",13456.0,1067.0],[12,"Qatar",2205479.43,193489.5],[12,"KSA",225017.0,25517.1],[12,"UAE",60367.42,4367.42],[11,"Qatar",22000.0,920.08],[11,"UAE",7258.0,825.56],[9,"UAE",40380.99,3229.99],[9,"KSA",34163.0,2732.91],[9,"Qatar",15450.0,1407.01],[8,"KSA",25500.0,2040.26],[8,"Qatar",126614.79,18629.77],[6,"UAE",44148.0,3366.41],[5,"Qatar",5000.0,400.0],[4,"KSA",666668.0,53334.16],[4,"Qatar",10300.0,555.74],[3,"Qatar",-248687.0,-15941.44],[3,"Oman",11060.0,884.8],[2,"Qatar",144328.0,10737.89]],"2024":[[12,"Qatar",568808.0,29485.15],[12,"UAE",118970.73,11466.98],[10,"KSA",-230778.0,-26800.38],[9,"Qatar",43000.01,3496.01],[9,"KSA",42776.0,4247.26],[8,"Qatar",-3000.0,-200.4],[5,"Qatar",331616.0,30910.91],[3,"Qatar",25000.0,2500.0],[3,"Oman",22000.0,-1922.08],[2,"Qatar",63000.0,6300.0],[2,"Levant",75000.0,3889.92]]},"Nozomi":{"2026":[[7,"KSA",1491381.0,126213.19]]},"Cybersec":{"2026":[[7,"KSA",22500.0,4649.73],[2,"KSA",10714.0,2226.36]],"2025":[[12,"KSA",19500.0,6375.16],[11,"KSA",38000.0,11370.08],[8,"Qatar",-30000.0,-5001.0],[7,"KSA",14000.0,2000.02],[6,"Oman",-10000.0,-5000.0],[6,"KSA",37286.0,7885.89],[4,"KSA",27500.0,5240.53],[1,"KSA",23504.0,3503.96]],"2024":[[12,"KSA",105733.0,21233.39],[12,"Oman",-10000.0,-5000.0],[9,"KSA",32789.0,6788.57],[7,"KSA",35000.0,12325.03],[6,"UAE",-1500.0,-250.05],[2,"KSA",19500.0,3599.95]]},"Ridge Security":{"2026":[[7,"KSA",462294.0,130794.11],[6,"UAE",17284.34,793.94]],"2025":[[6,"UAE",23766.1,1092.1]]},"Invicti":{"2026":[[7,"French Africa",22000.0,2200.0]]},"Consultancy":{"2026":[[7,"UAE",19012.94,952.13],[1,"UAE",171381.88,8569.74]]},"Checkmarx":{"2026":[[6,"UAE",182214.67,15260.53],[6,"Kuwait",349032.33,22567.33],[6,"KSA",55486.0,3883.86],[6,"Rest of the world",25000.0,1750.0],[5,"KSA",691040.0,37167.72],[5,"Eastern Africa",825276.72,49819.48],[5,"UAE",58422.06,3617.4],[4,"UAE",216000.0,15255.0],[4,"KSA",160233.0,11483.69],[3,"UAE",276124.78,19333.7],[3,"KSA",237404.0,16654.59],[3,"Eastern Africa",176200.0,19370.15],[2,"Eastern Africa",82000.31,4917.31],[2,"UAE",137500.0,9694.0],[1,"UAE",40870.0,2867.0]],"2025":[[12,"KSA",540896.0,37960.35],[12,"Eastern Africa",91499.98,6897.65],[12,"UAE",1187629.63,76372.1],[12,"Bahrain",49224.56,3946.56],[12,"French Africa",29100.72,2905.72],[12,"Rest of the world",65012.27,4551.55],[11,"KSA",21604.0,1529.14],[11,"UAE",147742.93,11719.93],[11,"Kuwait",96043.82,5762.82],[10,"KSA",75578.0,9190.02],[10,"UAE",103867.62,6528.27],[9,"UAE",373797.94,25459.94],[9,"Rest of the world",43600.0,2620.0],[9,"Western Africa",27000.0,1891.0],[9,"KSA",464977.0,29546.0],[8,"UAE",15010.21,1000.21],[8,"Kuwait",74625.0,7330.0],[7,"KSA",98013.0,7474.76],[7,"UAE",149292.19,11197.12],[6,"KSA",55486.0,3883.86],[6,"UAE",46700.25,4769.22],[6,"Kuwait",330743.0,19570.0],[5,"KSA",102817.0,6580.32],[5,"UAE",417755.33,27841.39],[4,"UAE",175584.91,12320.71],[3,"KSA",726633.3,41977.94],[3,"UAE",381234.65,27074.55],[3,"Eastern Africa",260560.0,17424.32],[2,"KSA",256618.0,13224.35],[1,"KSA",298538.0,21118.55]],"2024":[[12,"UAE",877249.73,54397.73],[12,"KSA",155955.0,8569.27],[12,"Rest of the world",58260.0,3916.0],[12,"French Africa",29100.72,2906.72],[12,"Kuwait",87960.0,5952.0],[11,"UAE",78506.76,4710.76],[10,"KSA",499081.0,39840.65],[10,"UAE",80819.99,5663.99],[9,"UAE",169438.27,20163.33],[9,"KSA",76570.0,5362.26],[8,"UAE",318120.13,19987.88],[8,"Bahrain",141968.0,11297.0],[7,"KSA",53910.0,3846.08],[7,"UAE",492125.8,33531.25],[6,"UAE",1015482.12,73718.12],[6,"KSA",313950.0,22323.03],[6,"Kuwait",164080.0,11578.0],[5,"UAE",194941.5,15252.5],[4,"UAE",25325.31,1860.31],[4,"Kuwait",75668.0,8168.0],[3,"UAE",230635.11,16522.17],[3,"KSA",220430.0,15546.01],[2,"UAE",22109.03,1772.03]]},"Netwitness":{"2026":[[6,"KSA",207464.0,22463.62],[6,"Arabic Africa",369304.51,39214.32],[5,"Arabic Africa",189771.49,9163.52],[3,"Arabic Africa",31960.0,3234.0],[3,"Qatar",134903.85,11857.69],[3,"KSA",146667.0,117866.85],[2,"Bahrain",20000.0,1500.0],[1,"Qatar",83415.0,5840.05]],"2025":[[12,"KSA",799121.0,42413.65],[12,"Qatar",20000.0,3000.0],[11,"KSA",63801.0,5106.35],[10,"Arabic Africa",53333.33,5333.14],[8,"KSA",290966.0,26266.05],[6,"KSA",12869.0,947.22],[5,"Arabic Africa",56405.63,5389.63],[5,"KSA",117236.0,7035.55],[4,"KSA",39524.0,1976.28],[3,"Qatar",313772.41,22020.47],[3,"KSA",158280.0,12023.44],[3,"Arabic Africa",98307.69,10667.69],[2,"UAE",6900.08,1367.08],[2,"Arabic Africa",106185.02,15202.02],[1,"Qatar",30000.0,3817.0],[1,"Arabic Africa",136761.0,16147.0]],"2024":[[12,"Oman",297367.03,23632.51],[11,"Arabic Africa",52173.92,5173.92],[11,"Oman",52406.13,5968.13],[11,"Qatar",144000.0,7784.0],[10,"KSA",107813.0,10312.57],[10,"Arabic Africa",370201.4,56227.4],[10,"French Africa",31500.0,4837.0],[9,"Oman",194333.68,7773.06],[9,"KSA",929989.0,71248.72],[9,"Arabic Africa",39785.0,2785.0],[7,"Arabic Africa",140000.5,23111.5],[7,"KSA",231649.0,11648.82],[6,"KSA",172897.0,10719.81],[5,"KSA",78920.0,3950.47],[3,"Arabic Africa",612191.19,128835.18],[3,"KSA",168814.0,3030.84],[2,"KSA",336620.0,20871.0]]},"BlueCat":{"2026":[[6,"Kuwait",140500.0,19503.0],[6,"Southern Africa",6862.0,1526.13],[2,"UAE",42530.55,6279.55],[2,"Southern Africa",559162.0,74332.1],[1,"Qatar",66658.99,6750.99],[1,"KSA",18368.0,1816.64]],"2025":[[12,"Arabic Africa",114515.2,23003.2],[12,"KSA",52376.0,5236.97],[10,"Southern Africa",84482.68,10560.33],[8,"KSA",5288.0,794.05],[8,"Kuwait",36000.0,2625.0],[8,"French Africa",75000.06,7714.06],[7,"KSA",700898.0,70905.03],[5,"Qatar",55312.0,5191.65],[3,"UAE",37898.1,4945.1],[2,"KSA",51509.0,1599.81],[1,"Qatar",26564.1,2656.1]],"2024":[[10,"Arabic Africa",-82694.4,-6226.89],[7,"KSA",710516.0,77039.79],[3,"UAE",33200.57,4550.57],[2,"KSA",50847.0,5027.39]]},"Digital.ai":{"2026":[[6,"Western Africa",99615.0,9960.0],[3,"KSA",713615.0,45116.17],[2,"Rest of the world",84725.74,19205.75]],"2025":[[4,"KSA",713615.0,45116.17]]},"Solarwinds-OT":{"2026":[[6,"KSA",7305.0,1461.15],[6,"Oman",27245.24,4089.24]],"2025":[[11,"KSA",19969.0,5121.8],[10,"Qatar",87296.99,15341.91]]},"Zahrat Amal":{"2026":[[6,"UAE",43865.0,5263.0],[2,"UAE",34349.98,3989.98]],"2025":[[6,"UAE",2500.0,300.0],[5,"Kuwait",17720.0,925.0],[5,"Oman",5502.0,1377.0]]},"One Trust":{"2026":[[6,"UAE",93000.0,10061.09]]},"Teramind":{"2026":[[6,"UAE",5670.0,875.0],[2,"Southern Africa",788.0,788.0]],"2025":[[12,"UAE",51503.88,5423.88]]},"Illumio":{"2026":[[6,"Levant",-2325.86,-4516.39],[4,"Levant",-3290.0,-343.96],[4,"KSA",111510.0,0.27],[3,"Levant",75451.56,8174.86],[2,"UAE",224188.2,15867.04]],"2025":[[12,"Levant",154390.0,19072.72],[11,"KSA",111510.0,0.27],[8,"UAE",590231.0,39655.0],[7,"Levant",159270.0,56976.0],[6,"Levant",119100.0,27795.0],[5,"Levant",73125.7,5849.99],[4,"UAE",182062.2,12744.36],[4,"Levant",22290.0,2022.72],[3,"Levant",17520.0,5042.0],[2,"Levant",77100.0,8070.0]],"2024":[[11,"Levant",124070.0,29918.0],[11,"KSA",318000.0,55003.26],[11,"Qatar",220000.0,50270.0],[10,"Levant",34000.0,24000.0],[9,"Qatar",77861.17,8718.17],[9,"UAE",313521.74,21931.74],[9,"Levant",39950.0,24950.0],[7,"Levant",42500.0,27500.0],[6,"UAE",254309.5,26106.32],[6,"Kuwait",0.01,-5020.1],[5,"Levant",30246.0,17446.01],[5,"Qatar",68887.0,7999.0],[5,"UAE",141175.0,9928.48],[4,"UAE",481817.24,24093.24],[3,"Levant",14336.96,5850.09],[2,"Rest of the world",63160.5,7070.5],[1,"KSA",59500.0,14220.02]]},"Camms":{"2026":[[5,"KSA",91950.0,19310.22]],"2025":[[9,"Qatar",30187.5,6037.5],[6,"KSA",69634.0,6468.99],[5,"KSA",109658.0,9630.54]],"2024":[[10,"KSA",10000.0,2999.48],[9,"KSA",-135950.0,-12629.75],[8,"Qatar",47000.0,4849.97],[5,"KSA",135950.0,12630.09]]},"Countercraft":{"2026":[[5,"KSA",327779.0,16390.51]],"2025":[[12,"Oman",42355.0,6355.0],[12,"Arabic Africa",166356.0,26651.0],[12,"KSA",180000.0,11330.47],[11,"KSA",90000.0,5666.82],[7,"KSA",359300.0,124300.42]],"2024":[[12,"KSA",646636.0,161659.51],[10,"Arabic Africa",144999.99,24999.99]]},"VaporVM":{"2026":[[5,"Kuwait",10666.8,1666.8]],"2024":[[7,"Qatar",4698.0,1098.0],[3,"Kuwait",12491.6,5491.6]]},"Redseal":{"2026":[[4,"UAE",58190.0,7091.0],[4,"Bahrain",5405.0,652.0],[3,"Arabic Africa",361601.5,78097.5]],"2025":[[12,"KSA",448475.0,151916.62],[12,"Levant",8805.0,1947.0],[11,"Levant",75500.0,15956.0],[10,"KSA",13576.0,2036.19],[7,"UAE",35295.0,9176.0],[7,"Western Africa",20457.95,4174.95],[5,"UAE",56372.0,6762.0],[3,"KSA",271679.0,127329.16],[2,"Bahrain",6920.4,849.4],[2,"Levant",39727.37,7154.37],[1,"KSA",147840.0,65682.8]],"2024":[[12,"KSA",134800.0,59236.11],[12,"Levant",46913.75,9633.75],[11,"KSA",12210.0,1220.09],[10,"KSA",15000.0,15000.02],[7,"KSA",181890.0,72883.42],[6,"Western Africa",19500.0,3980.0],[5,"UAE",85821.41,14163.41],[5,"KSA",204205.0,94602.2],[2,"Qatar",13633.0,1378.0],[1,"Bahrain",6453.6,779.6]]},"Phishrod":{"2026":[[4,"Southern Africa",22746.67,3412.0]],"2025":[[9,"KSA",48273.0,8790.47],[8,"KSA",-35400.0,1600.08],[7,"KSA",-109200.0,-26404.56],[6,"KSA",-86018.0,-16524.06],[4,"KSA",8235.0,1235.23]],"2024":[[12,"UAE",16469.72,138.12],[12,"KSA",144600.0,24800.31],[11,"KSA",24086.0,1686.11],[9,"UAE",178030.71,45366.85],[9,"Qatar",35260.0,9260.0],[6,"KSA",154664.0,26764.2],[6,"UAE",10000.0,1500.0],[5,"UAE",0.0,-0.58],[5,"KSA",0.0,0.53],[3,"UAE",210704.55,28704.55],[3,"KSA",3115.0,614.97],[1,"KSA",3240.0,239.87],[1,"UAE",18000.0,4000.0]]},"NSFOCUS":{"2026":[[4,"French Africa",27000.0,4432.17],[2,"KSA",8716.0,974.3]],"2025":[[3,"French Africa",7338.58,2494.4]]},"CyberSec":{"2026":[[4,"Arabic Africa",7500.0,1500.0]],"2025":[[10,"Qatar",15000.0,3000.0],[8,"KSA",-7500.0,-1200.0],[6,"Arabic Africa",20000.0,6000.0],[6,"UAE",2105.26,105.26],[5,"Qatar",8000.0,2000.0],[3,"Arabic Africa",6550.0,1550.0],[3,"UAE",4999.35,999.35],[3,"Qatar",30000.0,5000.0],[3,"Bahrain",1600.0,160.0]],"2024":[[12,"Oman",10000.0,5000.0],[10,"KSA",-20000.0,-3000.0],[10,"UAE",33250.0,1750.0],[9,"UAE",2105.26,105.26],[9,"Qatar",1250.0,250.0],[7,"Qatar",30000.0,9000.0],[5,"UAE",13327.16,5827.16],[5,"Qatar",16225.0,2725.0],[5,"Arabic Africa",32500.0,10000.0],[2,"UAE",3000.0,500.0],[1,"Kuwait",5500.0,1500.0]]},"Phosphorus":{"2026":[[4,"KSA",118420.0,5920.22],[3,"KSA",190008.0,9508.31]],"2025":[[12,"KSA",346710.0,52009.97],[11,"KSA",481001.0,73000.6],[10,"KSA",388267.0,58267.15],[10,"UAE",75625.0,19360.0],[8,"KSA",256000.0,32000.32],[3,"KSA",103541.0,15540.52],[1,"KSA",158850.0,23850.33]],"2024":[[11,"KSA",139020.0,21020.0],[10,"KSA",223440.0,72440.42],[9,"KSA",186611.0,27990.89],[3,"KSA",120000.0,18000.15],[2,"Arabic Africa",7500.0,1124.0]]},"Trend Micro":{"2026":[[3,"KSA",42422.0,4272.29],[1,"KSA",120511.0,14568.79]],"2025":[[12,"KSA",191826.0,11005.1],[10,"KSA",58150.0,4075.08],[9,"UAE",27630.5,1410.5],[9,"Bahrain",6000.0,829.52],[8,"KSA",462481.0,63287.12],[7,"KSA",197166.0,22492.32],[7,"Bahrain",1194.0,55.06],[3,"KSA",76217.0,5273.21]]},"Domain Tools":{"2026":[[3,"UAE",176192.47,15857.47]]},"Traceable":{"2026":[[3,"UAE",42542.37,2042.44]],"2025":[[10,"UAE",57000.13,2850.13],[5,"UAE",42542.37,2042.37],[2,"UAE",50020.42,2520.42]],"2024":[[12,"UAE",0.0,-0.61],[11,"UAE",40000.0,4000.0],[9,"UAE",57000.08,2850.08],[3,"UAE",42542.37,2042.37]]},"Armis":{"2026":[[3,"Arabic Africa",38750.84,1942.84]],"2025":[[3,"Arabic Africa",38745.87,1937.87]],"2024":[[3,"Arabic Africa",37000.0,1948.0]]},"Cyware":{"2026":[[3,"UAE",804244.69,96201.69]],"2025":[[11,"Levant",-39727.37,-1986.37],[9,"Levant",240000.0,12000.02],[4,"Levant",240000.0,12000.02]],"2024":[[11,"Levant",82500.0,8250.0],[10,"Levant",165008.0,15008.0],[9,"KSA",0.0,20.68],[5,"Levant",240000.0,12000.02],[4,"KSA",507995.0,37205.93]]},"Advenica":{"2026":[[3,"KSA",125940.0,28891.17],[2,"KSA",104000.0,34483.7]],"2025":[[11,"Rest of the world",163700.0,29133.82]]},"Sectigo":{"2026":[[3,"Qatar",13376.64,2856.56]]},"Secneural LLC":{"2026":[[3,"KSA",33000.0,23000.04]],"2024":[[12,"Qatar",13320.02,1666.02],[7,"Oman",6000.0,2500.0]]},"GuardByte Ltd":{"2026":[[2,"Oman",2500.0,500.0]],"2025":[[12,"Oman",2125.0,340.0],[12,"KSA",32815.0,7814.9],[11,"KSA",2650.0,550.07],[10,"Oman",2333.32,233.32],[7,"KSA",21300.0,2400.03]]},"ASCERTIA":{"2026":[[2,"KSA",602244.0,90690.7]]},"Axon":{"2026":[[1,"KSA",240727.0,40276.77]],"2025":[[2,"KSA",94107.0,10506.85]],"2024":[[12,"KSA",102856.0,15455.92]]},"Wallarm":{"2026":[[1,"KSA",-323527.0,-48011.41]],"2025":[[12,"Levant",47873.0,7671.0],[9,"Qatar",124952.69,14512.66],[8,"KSA",323527.0,48027.7]]},"Blackshields Cyber Security":{"2026":[[1,"KSA",1600.0,-2899.93]]},"Scythe":{"2026":[[1,"Bahrain",50000.0,20000.0]],"2025":[[10,"Qatar",30240.99,3240.86],[1,"Bahrain",50000.0,20000.0]]},"Industrial Defender":{"2025":[[12,"Kuwait",64384.0,6404.67]]},"Infeo":{"2025":[[12,"KSA",10000.0,3333.16],[9,"KSA",22500.0,7967.15]],"2024":[[6,"KSA",9002.0,3130.7]]},"Fasoo":{"2025":[[5,"KSA",15818.0,3578.13]],"2024":[[9,"KSA",300000.0,85000.37],[7,"KSA",31500.0,6835.91]]},"GWC Networks LLC":{"2025":[[12,"UAE",9600.0,5243.0],[10,"Qatar",19000.0,10600.0],[7,"KSA",18000.0,5399.89],[7,"Kuwait",3000.0,700.0],[5,"KSA",8000.0,3274.87],[4,"KSA",22933.0,5038.47],[3,"KSA",30000.0,11073.6]],"2024":[[12,"KSA",38014.0,4082.26]]},"Seclore":{"2025":[[11,"UAE",-20000.0,-5000.0],[10,"UAE",20000.0,5000.0],[6,"KSA",-65846.0,-2245.35],[6,"Arabic Africa",-19269.18,-2678.42]]},"Cystemsecurity":{"2025":[[11,"KSA",32222.0,3222.4]]},"NETbuilder":{"2025":[[11,"KSA",28800.0,2550.07],[10,"KSA",57600.0,5100.14],[9,"KSA",28800.0,2550.07],[7,"KSA",28800.0,2550.07],[6,"KSA",28800.0,2550.07],[5,"KSA",28800.0,2550.07],[4,"KSA",57600.0,5100.14],[1,"KSA",86400.0,7649.97]]},"Global Solutions":{"2025":[[11,"Arabic Africa",6000.0,1000.0]]},"Menlo":{"2025":[[10,"Arabic Africa",81031.41,6031.41]],"2024":[[6,"UAE",38800.0,6400.0]]},"Forescout-OT":{"2025":[[10,"KSA",556785.0,76747.0]]},"ThreatConnect":{"2025":[[9,"French Africa",239361.7,24361.7]]},"Cryptogreation":{"2025":[[9,"Arabic Africa",18000.0,-500.0],[2,"Arabic Africa",3750.0,1750.0]],"2024":[[6,"Arabic Africa",5700.0,700.0]]},"Strikeready":{"2025":[[9,"Qatar",45652.17,3652.17],[7,"Qatar",98821.08,8079.08],[4,"Qatar",59566.94,4566.8]],"2024":[[12,"Qatar",23000.0,2500.0],[9,"Qatar",97977.08,7235.08],[5,"Qatar",65047.06,4497.06],[4,"KSA",203000.0,15000.25],[3,"Qatar",47174.0,4174.0],[2,"UAE",104499.99,8499.99]]},"Carbon Tech FZ LLC":{"2025":[[8,"Arabic Africa",29000.0,8000.0]]},"Castra":{"2025":[[7,"KSA",30000.0,6000.04]]},"Augur Security (Seclytics)":{"2025":[[6,"KSA",686845.0,166844.54]]},"Nodesec":{"2025":[[6,"Oman",-7000.0,-1999.9],[6,"UAE",9000.0,2000.0],[6,"Rest of the world",13582.7,4102.7],[4,"UAE",4000.0,1000.0]],"2024":[[12,"Oman",-8000.0,-8000.0],[11,"UAE",8002.18,2002.18],[9,"Oman",7000.0,2000.0]]},"Certes":{"2025":[[3,"KSA",10275.0,3215.9]],"2024":[[6,"Levant",16842.0,2123.83]]},"Island Technology":{"2025":[[1,"Qatar",460796.0,120296.0]]},"Information Technology Solutions":{"2024":[[12,"Arabic Africa",46875.0,12753.0]]},"loop1":{"2024":[[12,"KSA",78712.0,9272.31],[10,"KSA",11500.0,3599.95],[7,"KSA",11533.0,-1502.23]]},"Mohammad Khan":{"2024":[[10,"Bahrain",7000.0,3500.0]]},"MAG Information":{"2024":[[5,"KSA",51412.0,16412.28]]},"EclecticIQ":{"2024":[[4,"Qatar",134062.5,36562.5]]},"Skyhigh":{"2024":[[2,"KSA",166797.0,16699.8]]},"RiskIQ":{"2024":[[2,"UAE",44000.0,11500.0]]},"Attivo":{"2024":[[2,"Levant",150000.0,15000.0]]},"Seceon":{"2024":[[2,"KSA",5416.0,516.26]]}};

// employees: [{name, entity, monthly:[12], total, vmode:"ALL"|"LIST", vendors:[], cmode:"ALL"|"LIST", countries:[]}]
// resolved from the real 2026 "Employee Cost Analysis" sheet, vendor/country names matched against the
// budget vendor & region lists (substring + alias matching) — a handful of terms didn't resolve (see DATA_QUALITY).
const SEED_EMPLOYEES = [{"name":"Abdallah Ibrahim Taha Alsheyyab","entity":"CBK","monthly":[16327.56,16327.56,16327.56,16817.39,16817.39,16817.39,16817.39,16817.39,16817.39,16817.39,16817.39,16817.39],"total":200339.19,"vmode":"LIST","vendors":["Checkmarx","Digital.ai","Entrust","Group IB","Harness","Invicti","Xage"],"cmode":"ALL","countries":[]},{"name":"Abdullah Eid AlAnazi","entity":"CBK","monthly":[1892.39,1892.39,1892.39,1949.16,1949.16,1949.16,1949.16,1949.16,1949.16,1949.16,1949.16,1949.16],"total":23219.61,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Ahmad Abdullah Hamad","entity":"KFT","monthly":[12394.16,12394.16,12394.16,12765.98,12765.98,12765.98,12765.98,12765.98,12765.98,12765.98,12765.98,12765.98],"total":152076.3,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Saeed Saleh Saeed Al Modi","entity":null,"monthly":[10178.35,10178.35,10178.35,10483.7,10483.7,10483.7,10483.7,10483.7,10483.7,10483.7,10483.7,10483.7],"total":124888.35,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Ahmed Magdi Ahmed Elbahnihi","entity":null,"monthly":[9855.68,9855.68,9855.68,10151.35,10151.35,10151.35,10151.35,10151.35,10151.35,10151.35,10151.35,10151.35],"total":120929.19,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Ahmed Hany","entity":null,"monthly":[12554.79,12554.79,12554.79,12931.43,12931.43,12931.43,12931.43,12931.43,12931.43,12931.43,12931.43,12931.43],"total":154047.24,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Alan Charly","entity":null,"monthly":[3915.74,3915.74,3915.74,4033.22,4033.22,4033.22,4033.22,4033.22,4033.22,4033.22,4033.22,4033.22],"total":48046.2,"vmode":"LIST","vendors":["Netskope"],"cmode":"ALL","countries":[]},{"name":"Alanoud Ibrahim Musharraf Almusharraf","entity":null,"monthly":[1080.78,1080.78,1080.78,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2],"total":13261.14,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Anandi Sekar Gounder","entity":null,"monthly":[6171.52,6171.52,6171.52,6356.66,6356.66,6356.66,6356.66,6356.66,6356.66,6356.66,6356.66,6356.66],"total":75724.5,"vmode":"LIST","vendors":["ACCUKNOX","Harness","Invicti","Lookout","Solarwinds"],"cmode":"ALL","countries":[]},{"name":"Arif Raza Zaidi","entity":null,"monthly":[2544.55,2544.55,2544.55,2620.89,2620.89,2620.89,2620.89,2620.89,2620.89,2620.89,2620.89,2620.89],"total":31221.66,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Ashutosh Sen Chandan Sen","entity":null,"monthly":[3625.12,3625.12,3625.12,3733.87,3733.87,3733.87,3733.87,3733.87,3733.87,3733.87,3733.87,3733.87],"total":44480.19,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Atheer Abdullah Iqal Almutairi","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"AVINASH CHANDRU ADVANI","entity":null,"monthly":[34085.02,34085.02,34085.02,35107.57,35107.57,35107.57,35107.57,35107.57,35107.57,35107.57,35107.57,35107.57],"total":418223.19,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"CLAIRE GAIL CORDOVIZ SAN DIEGO","entity":null,"monthly":[1589.57,1589.57,1589.57,1637.26,1637.26,1637.26,1637.26,1637.26,1637.26,1637.26,1637.26,1637.26],"total":19504.05,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Defallah Aghsain Alshaibani","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Dinesh Lalwani","entity":null,"monthly":[3869.66,3869.66,3869.66,3985.75,3985.75,3985.75,3985.75,3985.75,3985.75,3985.75,3985.75,3985.75],"total":47480.73,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Eslam Sayed Abdel Hamid","entity":null,"monthly":[9988.79,9988.79,9988.79,10288.45,10288.45,10288.45,10288.45,10288.45,10288.45,10288.45,10288.45,10288.45],"total":122562.42,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Essam Naddaf","entity":null,"monthly":[4843.63,4843.63,4843.63,4988.94,4988.94,4988.94,4988.94,4988.94,4988.94,4988.94,4988.94,4988.94],"total":59431.35,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"FAHAD DALWAI","entity":null,"monthly":[10970.03,10970.03,10970.03,11299.13,11299.13,11299.13,11299.13,11299.13,11299.13,11299.13,11299.13,11299.13],"total":134602.26,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"LIST","countries":["KSA"]},{"name":"Mahmoud Abouelwafa","entity":null,"monthly":[4111.12,4111.12,4111.12,4234.46,4234.46,4234.46,4234.46,4234.46,4234.46,4234.46,4234.46,4234.46],"total":50443.5,"vmode":"LIST","vendors":["Akamai","Appgate","Forescout","Group IB","Harness","Proofpoint"],"cmode":"ALL","countries":[]},{"name":"Geetha Yechana","entity":null,"monthly":[16242.05,16242.05,16242.05,16729.31,16729.31,16729.31,16729.31,16729.31,16729.31,16729.31,16729.31,16729.31],"total":199289.94,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"ALL","countries":[]},{"name":"GIRISH DL KUMAR","entity":null,"monthly":[12432.46,12432.46,12432.46,12805.44,12805.44,12805.44,12805.44,12805.44,12805.44,12805.44,12805.44,12805.44],"total":152546.34,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Bahrain"]},{"name":"Ibrahim Hammad","entity":null,"monthly":[15782.92,15782.92,15782.92,16256.41,16256.41,16256.41,16256.41,16256.41,16256.41,16256.41,16256.41,16256.41],"total":193656.45,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Kuwait"]},{"name":"Joseph Fernandez","entity":null,"monthly":[3353.09,3353.09,3353.09,3453.68,3453.68,3453.68,3453.68,3453.68,3453.68,3453.68,3453.68,3453.68],"total":41142.39,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Kaviarasan Asokan","entity":null,"monthly":[10234.23,10234.23,10234.23,10541.26,10541.26,10541.26,10541.26,10541.26,10541.26,10541.26,10541.26,10541.26],"total":125574.03,"vmode":"LIST","vendors":["Cribl","Crowdstrike","Elastic"],"cmode":"ALL","countries":[]},{"name":"Lama Khalid Mohammed Albkr","entity":null,"monthly":[1080.78,1080.78,1080.78,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2,1113.2],"total":13261.14,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"MAHMOUD SUBHI SALEEM ALYOUSEF","entity":null,"monthly":[11730.88,11730.88,11730.88,12082.81,12082.81,12082.81,12082.81,12082.81,12082.81,12082.81,12082.81,12082.81],"total":143937.93,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Mashari Al Enezi","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Megha Arora","entity":null,"monthly":[7542.58,7542.58,7542.58,7768.86,7768.86,7768.86,7768.86,7768.86,7768.86,7768.86,7768.86,7768.86],"total":92547.48,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"MOHAMED ASSEM MOHAMED BAYOUMY ELADAWY","entity":null,"monthly":[3475.19,3475.19,3475.19,3579.45,3579.45,3579.45,3579.45,3579.45,3579.45,3579.45,3579.45,3579.45],"total":42640.62,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["French Africa","KSA","Levant"]},{"name":"Mohammed Nadeem","entity":null,"monthly":[6730.94,6730.94,6730.94,6932.87,6932.87,6932.87,6932.87,6932.87,6932.87,6932.87,6932.87,6932.87],"total":82588.65,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Moosa Yusuf Kazi","entity":null,"monthly":[12568.3,12568.3,12568.3,12945.35,12945.35,12945.35,12945.35,12945.35,12945.35,12945.35,12945.35,12945.35],"total":154213.05,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Bahrain","Qatar"]},{"name":"Norah Abdulaziz Altammami","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Osamah Basel Khalfeh","entity":null,"monthly":[11948.72,11948.72,11948.72,12307.18,12307.18,12307.18,12307.18,12307.18,12307.18,12307.18,12307.18,12307.18],"total":146610.78,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Naoufal Mzali","entity":null,"monthly":[23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3,23056.3],"total":276675.6,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Omar Khaled abdelmonsef Shwail","entity":null,"monthly":[3877.5,3877.5,3877.5,3993.83,3993.83,3993.83,3993.83,3993.83,3993.83,3993.83,3993.83,3993.83],"total":47576.97,"vmode":"LIST","vendors":["Augur Security (Seclytics)","Countercraft","Cyware","Elastic","Hexnode","Swimlane"],"cmode":"ALL","countries":[]},{"name":"Sameer Seth","entity":null,"monthly":[14885.2,14885.2,14885.2,15331.75,15331.75,15331.75,15331.75,15331.75,15331.75,15331.75,15331.75,15331.75],"total":182641.35,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Sana Kausar","entity":null,"monthly":[5579.77,5579.77,5579.77,5747.16,5747.16,5747.16,5747.16,5747.16,5747.16,5747.16,5747.16,5747.16],"total":68463.75,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Saif Nasir Ali Khan Khan Nasir Ali","entity":null,"monthly":[8765.06,8765.06,8765.06,9028.01,9028.01,9028.01,9028.01,9028.01,9028.01,9028.01,9028.01,9028.01],"total":107547.27,"vmode":"LIST","vendors":["Fortra","Hexnode","Lookout","Paladin AI","Teramind"],"cmode":"ALL","countries":[]},{"name":"Prakash J R ","entity":null,"monthly":[7378.41,7378.41,7378.41,7599.77,7599.77,7599.77,7599.77,7599.77,7599.77,7599.77,7599.77,7599.77],"total":90533.16,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Iysa Qureshi ","entity":null,"monthly":[3520.65,3520.65,3520.65,3626.27,3626.27,3626.27,3626.27,3626.27,3626.27,3626.27,3626.27,3626.27],"total":43198.38,"vmode":"LIST","vendors":["Checkmarx","Digital.ai","Entrust","Group IB","Harness","Invicti","Xage"],"cmode":"ALL","countries":[]},{"name":"MOHAMED CHAHID ALAOUI","entity":null,"monthly":[4357.48,4357.48,4357.48,4488.2,4488.2,4488.2,4488.2,4488.2,4488.2,4488.2,4488.2,4488.2],"total":53466.24,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["French Africa"]},{"name":"Sultan Turki  AlSaif","entity":null,"monthly":[1081.99,1081.99,1081.99,1114.45,1114.45,1114.45,1114.45,1114.45,1114.45,1114.45,1114.45,1114.45],"total":13276.02,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Tareq Elqadah","entity":null,"monthly":[8699.24,8699.24,8699.24,8960.22,8960.22,8960.22,8960.22,8960.22,8960.22,8960.22,8960.22,8960.22],"total":106739.7,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Siddharth Mahesh Kumar","entity":null,"monthly":[10640.15,10640.15,10640.15,10959.35,10959.35,10959.35,10959.35,10959.35,10959.35,10959.35,10959.35,10959.35],"total":130554.6,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"ALL","countries":[]},{"name":"Ahmad Jihad Samra","entity":null,"monthly":[9925.23,9925.23,9925.23,10222.98,10222.98,10222.98,10222.98,10222.98,10222.98,10222.98,10222.98,10222.98],"total":121782.51,"vmode":"LIST","vendors":["Proofpoint","Swimlane"],"cmode":"ALL","countries":[]},{"name":"Muhammad Marakkoottathil","entity":null,"monthly":[14452.84,14452.84,14452.84,14886.42,14886.42,14886.42,14886.42,14886.42,14886.42,14886.42,14886.42,14886.42],"total":177336.3,"vmode":"LIST","vendors":["Akamai","Arista","Forescout","Gigamon"],"cmode":"ALL","countries":[]},{"name":"Shanthi Kasiraman","entity":null,"monthly":[5206.25,5206.25,5206.25,5362.44,5362.44,5362.44,5362.44,5362.44,5362.44,5362.44,5362.44,5362.44],"total":63880.71,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"ALL","countries":[]},{"name":"Catherine Salazar","entity":null,"monthly":[3127.28,3127.28,3127.28,3221.1,3221.1,3221.1,3221.1,3221.1,3221.1,3221.1,3221.1,3221.1],"total":38371.74,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Samiha Younis","entity":null,"monthly":[10495.14,10495.14,10495.14,10809.99,10809.99,10809.99,10809.99,10809.99,10809.99,10809.99,10809.99,10809.99],"total":128775.33,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Oman"]},{"name":"Vivek Gupta","entity":null,"monthly":[34040.26,34040.26,34040.26,35061.47,35061.47,35061.47,35061.47,35061.47,35061.47,35061.47,35061.47,35061.47],"total":417674.01,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Mohammed Riyadh Mohammed Alazzah","entity":null,"monthly":[17600.24,17600.24,17600.24,18128.25,18128.25,18128.25,18128.25,18128.25,18128.25,18128.25,18128.25,18128.25],"total":215954.97,"vmode":"LIST","vendors":["Akamai","Arista","Forescout","Gigamon"],"cmode":"ALL","countries":[]},{"name":"Mohamed Ashraf Ahmed Mohamed Ezzat","entity":null,"monthly":[5782.89,5782.89,5782.89,5956.38,5956.38,5956.38,5956.38,5956.38,5956.38,5956.38,5956.38,5956.38],"total":70956.09,"vmode":"LIST","vendors":["ACCUKNOX","Certes","Elastic","Immersive Labs","Proofpoint","Utimaco"],"cmode":"LIST","countries":["KSA"]},{"name":"Saquib Khan","entity":null,"monthly":[3285,3285,3285,3383.55,3383.55,3383.55,3383.55,3383.55,3383.55,3383.55,3383.55,3383.55],"total":40306.95,"vmode":"LIST","vendors":["BlueCat","Netskope","Redseal","Solarwinds"],"cmode":"ALL","countries":[]},{"name":"Amr Ahmed Ahmed Mohamed elsayed","entity":null,"monthly":[13932.46,13932.46,13932.46,14350.43,14350.43,14350.43,14350.43,14350.43,14350.43,14350.43,14350.43,14350.43],"total":170951.25,"vmode":"LIST","vendors":["Advenica","Industrial Defender","Nozomi","Replil","TXOne"],"cmode":"ALL","countries":[]},{"name":"Alyah Abdulrahman Aloudah","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Alhanouf Abdulaziz Muhammad AlTammami","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Mohammed Mousa","entity":null,"monthly":[14683.37,14683.37,14683.37,15123.87,15123.87,15123.87,15123.87,15123.87,15123.87,15123.87,15123.87,15123.87],"total":180164.94,"vmode":"LIST","vendors":["Advenica","Industrial Defender","Nozomi","Replil","TXOne"],"cmode":"ALL","countries":[]},{"name":"TAREK SHERIF SAYED IBRAHIM","entity":null,"monthly":[11102.76,11102.76,11102.76,11435.84,11435.84,11435.84,11435.84,11435.84,11435.84,11435.84,11435.84,11435.84],"total":136230.84,"vmode":"LIST","vendors":["Countercraft","Netwitness","Redseal","Security Scorecard","ThreatConnect","Utimaco"],"cmode":"ALL","countries":[]},{"name":"Ashleigh Watson","entity":null,"monthly":[11651.2,11651.2,11651.2,12000.73,12000.73,12000.73,12000.73,12000.73,12000.73,12000.73,12000.73,12000.73],"total":142960.17,"vmode":"LIST","vendors":["Checkmarx","Harness","Invicti","Netwrix","ON2IT","ThreatConnect"],"cmode":"ALL","countries":[]},{"name":"Emna Drissi","entity":null,"monthly":[6104.59,6104.59,6104.59,6287.73,6287.73,6287.73,6287.73,6287.73,6287.73,6287.73,6287.73,6287.73],"total":74903.34,"vmode":"LIST","vendors":["Cribl","Elastic","Immersive Labs","Minio","Swimlane"],"cmode":"LIST","countries":["Levant"]},{"name":"Abdallah Emad Yousef Awwad Abbady","entity":null,"monthly":[5681,5681,5681,5851.43,5851.43,5851.43,5851.43,5851.43,5851.43,5851.43,5851.43,5851.43],"total":69705.87,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Waleed Zafar Mughal ","entity":null,"monthly":[2263.79,2263.79,2263.79,2331.71,2331.71,2331.71,2331.71,2331.71,2331.71,2331.71,2331.71,2331.71],"total":27776.76,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Faiz Aftab","entity":null,"monthly":[12997.38,12997.38,12997.38,13387.3,13387.3,13387.3,13387.3,13387.3,13387.3,13387.3,13387.3,13387.3],"total":159477.84,"vmode":"LIST","vendors":["Appgate","BlueCat","Certes","Domain Tools","Exagrid","Solarwinds"],"cmode":"ALL","countries":[]},{"name":"Yaseen Pasha Eliyas","entity":null,"monthly":[10905.16,10905.16,10905.16,11232.32,11232.32,11232.32,11232.32,11232.32,11232.32,11232.32,11232.32,11232.32],"total":133806.36,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Qatar"]},{"name":"Zakaria Fawzy","entity":null,"monthly":[4097.5,4097.5,4097.5,4220.43,4220.43,4220.43,4220.43,4220.43,4220.43,4220.43,4220.43,4220.43],"total":50276.37,"vmode":"LIST","vendors":["BlueCat","Crowdstrike","Immersive Labs","Invicti","Solarwinds","Xage"],"cmode":"ALL","countries":[]},{"name":"Anjali Saxena","entity":null,"monthly":[10031.41,10031.41,10031.41,10332.35,10332.35,10332.35,10332.35,10332.35,10332.35,10332.35,10332.35,10332.35],"total":123085.38,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Shalini Arvind Sharma","entity":null,"monthly":[2905.2,2905.2,2905.2,2992.36,2992.36,2992.36,2992.36,2992.36,2992.36,2992.36,2992.36,2992.36],"total":35646.84,"vmode":"LIST","vendors":["Appgate","BlueCat","Certes","Domain Tools","Exagrid","Solarwinds"],"cmode":"ALL","countries":[]},{"name":"Mina Mahfouz Malak Megly","entity":null,"monthly":[9171.64,9171.64,9171.64,9446.78,9446.78,9446.78,9446.78,9446.78,9446.78,9446.78,9446.78,9446.78],"total":112535.94,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Monica Mukherjee","entity":null,"monthly":[7266.59,7266.59,7266.59,7484.58,7484.58,7484.58,7484.58,7484.58,7484.58,7484.58,7484.58,7484.58],"total":89160.99,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Samir Omar","entity":null,"monthly":[22389.18,22389.18,22389.18,23060.86,23060.86,23060.86,23060.86,23060.86,23060.86,23060.86,23060.86,23060.86],"total":274715.28,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Ali Younis Muammar ","entity":null,"monthly":[11153.53,11153.53,11153.53,11488.13,11488.13,11488.13,11488.13,11488.13,11488.13,11488.13,11488.13,11488.13],"total":136853.76,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Pooja Manja Devadiga ","entity":null,"monthly":[4558.06,4558.06,4558.06,4694.8,4694.8,4694.8,4694.8,4694.8,4694.8,4694.8,4694.8,4694.8],"total":55927.38,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"AZIM MAHMED ALI JAFFER","entity":null,"monthly":[7881.12,7881.12,7881.12,8117.55,8117.55,8117.55,8117.55,8117.55,8117.55,8117.55,8117.55,8117.55],"total":96701.31,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Kuwait"]},{"name":"Mohamed Fathi Fadel Ibrahim ","entity":null,"monthly":[1361.47,1361.47,1361.47,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31],"total":16705.2,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"SHASHIDHARA KUNDER","entity":null,"monthly":[2802.22,2802.22,2802.22,2886.29,2886.29,2886.29,2886.29,2886.29,2886.29,2886.29,2886.29,2886.29],"total":34383.27,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"BELAL N M AL EISAWI","entity":null,"monthly":[4129.84,4129.84,4129.84,4253.73,4253.73,4253.73,4253.73,4253.73,4253.73,4253.73,4253.73,4253.73],"total":50673.09,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Yaadhna Singh Gounden ","entity":null,"monthly":[18000,18000,18000,18540,18540,18540,18540,18540,18540,18540,18540,18540],"total":220860,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Wael Jaber","entity":null,"monthly":[20395.84,20395.84,20395.84,21007.71,21007.71,21007.71,21007.71,21007.71,21007.71,21007.71,21007.71,21007.71],"total":250256.91,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Mohamed Hossameldin Ali mohamed Ali ","entity":null,"monthly":[9625,9625,9625,9913.75,9913.75,9913.75,9913.75,9913.75,9913.75,9913.75,9913.75,9913.75],"total":118098.75,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Halawa Al Anazi  ","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Sara Ibrahim Al Fuheid  ","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Raghad Matar AlAnazi   ","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Najlaa Khalid AlBkr  ","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Ahlam Saad AlMalki  ","entity":null,"monthly":[1066.67,1066.67,1066.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67,1098.67],"total":13088.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Ashwag Abdulrazzaq Ghbair ","entity":null,"monthly":[2043.25,2043.25,2043.25,2104.55,2104.55,2104.55,2104.55,2104.55,2104.55,2104.55,2104.55,2104.55],"total":25070.7,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Wahid Ali Musaed Alarasi","entity":null,"monthly":[8867.53,8867.53,8867.53,9133.55,9133.55,9133.55,9133.55,9133.55,9133.55,9133.55,9133.55,9133.55],"total":108804.54,"vmode":"LIST","vendors":["BlueCat","Cribl","Elastic","Entrust","Swimlane"],"cmode":"ALL","countries":[]},{"name":"Mohamed Ali EzzEldeen Ali","entity":null,"monthly":[7387.36,7387.36,7387.36,7608.98,7608.98,7608.98,7608.98,7608.98,7608.98,7608.98,7608.98,7608.98],"total":90642.9,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Mohamed Fawzy Ali Hassan","entity":null,"monthly":[8854.02,8854.02,8854.02,9119.64,9119.64,9119.64,9119.64,9119.64,9119.64,9119.64,9119.64,9119.64],"total":108638.82,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"NAZEM NABIL AWIK","entity":null,"monthly":[2259.54,2259.54,2259.54,2327.33,2327.33,2327.33,2327.33,2327.33,2327.33,2327.33,2327.33,2327.33],"total":27724.59,"vmode":"LIST","vendors":["Appgate","Entrust","Fortra","Group IB","Netskope","Xage"],"cmode":"ALL","countries":[]},{"name":"Prabhakar Manche","entity":null,"monthly":[2493.48,2493.48,2493.48,2568.28,2568.28,2568.28,2568.28,2568.28,2568.28,2568.28,2568.28,2568.28],"total":30594.96,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"ALL","countries":[]},{"name":"Praveen K R","entity":null,"monthly":[2358.52,2358.52,2358.52,2429.28,2429.28,2429.28,2429.28,2429.28,2429.28,2429.28,2429.28,2429.28],"total":28939.08,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Vaishnav Shyla","entity":null,"monthly":[1540.06,1540.06,1540.06,1586.26,1586.26,1586.26,1586.26,1586.26,1586.26,1586.26,1586.26,1586.26],"total":18896.52,"vmode":"LIST","vendors":["Augur Security (Seclytics)","BlueCat","Crowdstrike","Solarwinds","ThreatConnect"],"cmode":"ALL","countries":[]},{"name":"Anas Hazem Al Hammouri","entity":null,"monthly":[15691.85,15691.85,15691.85,16162.6,16162.6,16162.6,16162.6,16162.6,16162.6,16162.6,16162.6,16162.6],"total":192538.95,"vmode":"LIST","vendors":["Cribl","Elastic","Immersive Labs","Minio","Swimlane"],"cmode":"ALL","countries":[]},{"name":"Ayman Ali Sharaf","entity":null,"monthly":[12084.92,12084.92,12084.92,12447.47,12447.47,12447.47,12447.47,12447.47,12447.47,12447.47,12447.47,12447.47],"total":148281.99,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Samreen Banu","entity":null,"monthly":[12741.43,12741.43,12741.43,13123.67,13123.67,13123.67,13123.67,13123.67,13123.67,13123.67,13123.67,13123.67],"total":156337.32,"vmode":"LIST","vendors":["ACCUKNOX","Ardent Privacy","Cyware","FASOO","Netskope","Netwrix"],"cmode":"ALL","countries":[]},{"name":"Mischka Parsad","entity":null,"monthly":[2750,2750,2750,2832.5,2832.5,2832.5,2832.5,2832.5,2832.5,2832.5,2832.5,2832.5],"total":33742.5,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Eastern Africa"]},{"name":"Mohamed Mahmoud Abd Elaaty Mohamed","entity":null,"monthly":[4400,4400,4400,4532,4532,4532,4532,4532,4532,4532,4532,4532],"total":53988,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Shahd Maged Eldokky","entity":null,"monthly":[4400,4400,4400,4532,4532,4532,4532,4532,4532,4532,4532,4532],"total":53988,"vmode":"LIST","vendors":["Fortra","Hexnode","Paladin AI","Teramind"],"cmode":"LIST","countries":["Levant"]},{"name":"Mohamed Elsayed Mohamed Soliman","entity":null,"monthly":[3493.75,3493.75,3493.75,3598.56,3598.56,3598.56,3598.56,3598.56,3598.56,3598.56,3598.56,3598.56],"total":42868.29,"vmode":"LIST","vendors":["Keyfactor","Netskope","Swimlane","Utimaco"],"cmode":"ALL","countries":[]},{"name":"Juan Van Appel","entity":null,"monthly":[10515.5,10515.5,10515.5,10830.97,10830.97,10830.97,10830.97,10830.97,10830.97,10830.97,10830.97,10830.97],"total":129025.23,"vmode":"LIST","vendors":["Akamai","Arista","Forescout","Gigamon"],"cmode":"LIST","countries":["Levant"]},{"name":"Cherry Joy Lopez ","entity":null,"monthly":[3789.65,3789.65,3789.65,3903.34,3903.34,3903.34,3903.34,3903.34,3903.34,3903.34,3903.34,3903.34],"total":46499.01,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Jo Ann Macale Onadia","entity":null,"monthly":[4391.85,4391.85,4391.85,4523.61,4523.61,4523.61,4523.61,4523.61,4523.61,4523.61,4523.61,4523.61],"total":53888.04,"vmode":"LIST","vendors":["Cribl","Elastic","Immersive Labs","Minio","Swimlane"],"cmode":"ALL","countries":[]},{"name":"Praveena Pushparajan","entity":null,"monthly":[1412.99,1412.99,1412.99,1455.38,1455.38,1455.38,1455.38,1455.38,1455.38,1455.38,1455.38,1455.38],"total":17337.39,"vmode":"LIST","vendors":["Ardent Privacy","Certes","Exagrid","FASOO","Fortra"],"cmode":"ALL","countries":[]},{"name":"Mouna Ae Boudoullah","entity":null,"monthly":[4632.7,4632.7,4632.7,4771.68,4771.68,4771.68,4771.68,4771.68,4771.68,4771.68,4771.68,4771.68],"total":56843.22,"vmode":"LIST","vendors":["Checkmarx","Entrust","Group IB","Harness","Invicti"],"cmode":"ALL","countries":[]},{"name":"Seema Deepak Vyas","entity":null,"monthly":[4575.45,4575.45,4575.45,4712.71,4712.71,4712.71,4712.71,4712.71,4712.71,4712.71,4712.71,4712.71],"total":56140.74,"vmode":"LIST","vendors":["Countercraft","Netwitness","Redseal","Security Scorecard","ThreatConnect","Utimaco"],"cmode":"ALL","countries":[]},{"name":"Ribha Gajanan Aserkar","entity":null,"monthly":[15623.67,15623.67,15623.67,16092.38,16092.38,16092.38,16092.38,16092.38,16092.38,16092.38,16092.38,16092.38],"total":191702.43,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"ALL","countries":[]},{"name":"Mahmoud Sherif Hussein Ghanem","entity":null,"monthly":[7333.33,7333.33,7333.33,7553.33,7553.33,7553.33,7553.33,7553.33,7553.33,7553.33,7553.33,7553.33],"total":89979.96,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"LIST","countries":["Levant"]},{"name":"Maya Rashid Mohamad Saed Al Nahlawi","entity":null,"monthly":[6587.27,6587.27,6587.27,6784.89,6784.89,6784.89,6784.89,6784.89,6784.89,6784.89,6784.89,6784.89],"total":80825.82,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Qatar"]},{"name":"NICANORY OKONGO ATEYA","entity":null,"monthly":[11198,11198,11198,11533.94,11533.94,11533.94,11533.94,11533.94,11533.94,11533.94,11533.94,11533.94],"total":137399.46,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Eastern Africa"]},{"name":"MOHAMMED AZEEM ALAM","entity":null,"monthly":[6714.2,6714.2,6714.2,6915.63,6915.63,6915.63,6915.63,6915.63,6915.63,6915.63,6915.63,6915.63],"total":82383.27,"vmode":"LIST","vendors":["BlueCat","Domain Tools","Exagrid","Solarwinds"],"cmode":"LIST","countries":["KSA"]},{"name":"Ahmed Ali Elbehery","entity":null,"monthly":[7280.43,7280.43,7280.43,7498.85,7498.85,7498.85,7498.85,7498.85,7498.85,7498.85,7498.85,7498.85],"total":89330.94,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"DOUNIA MOKADADER","entity":null,"monthly":[1500,1500,1500,1545,1545,1545,1545,1545,1545,1545,1545,1545],"total":18405,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Omar Mostafa Hanafy","entity":null,"monthly":[4300,4300,4300,4429,4429,4429,4429,4429,4429,4429,4429,4429],"total":52761,"vmode":"LIST","vendors":["Appgate","BlueCat","Certes","Domain Tools","Exagrid","Solarwinds"],"cmode":"LIST","countries":["Levant"]},{"name":"Ghada Sherif Ahmed Hamido","entity":null,"monthly":[3850,3850,3850,3965.5,3965.5,3965.5,3965.5,3965.5,3965.5,3965.5,3965.5,3965.5],"total":47239.5,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Raship Chhabra","entity":null,"monthly":[13205.19,13205.19,13205.19,13601.35,13601.35,13601.35,13601.35,13601.35,13601.35,13601.35,13601.35,13601.35],"total":162027.72,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Abdulaziz Ali Mohammed Abdullah","entity":null,"monthly":[5200,5200,5200,5356,5356,5356,5356,5356,5356,5356,5356,5356],"total":63804,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Mostafa Ahmed Khattab","entity":null,"monthly":[9744.8,9744.8,9744.8,10037.14,10037.14,10037.14,10037.14,10037.14,10037.14,10037.14,10037.14,10037.14],"total":119568.66,"vmode":"LIST","vendors":["Checkmarx","Digital.ai","Entrust","Group IB","Harness","Invicti","Xage"],"cmode":"LIST","countries":["KSA"]},{"name":"Walid Mohamed","entity":null,"monthly":[10266.67,10266.67,10266.67,10574.67,10574.67,10574.67,10574.67,10574.67,10574.67,10574.67,10574.67,10574.67],"total":125972.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Lara Yazigi ","entity":null,"monthly":[12564.52,12564.52,12564.52,12941.46,12941.46,12941.46,12941.46,12941.46,12941.46,12941.46,12941.46,12941.46],"total":154166.7,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Mohammad Hasnain Farooqui","entity":null,"monthly":[8502.8,8502.8,8502.8,8757.89,8757.89,8757.89,8757.89,8757.89,8757.89,8757.89,8757.89,8757.89],"total":104329.41,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"ALL","countries":[]},{"name":"Sachin Mohan ","entity":null,"monthly":[9693.67,9693.67,9693.67,9984.48,9984.48,9984.48,9984.48,9984.48,9984.48,9984.48,9984.48,9984.48],"total":118941.33,"vmode":"LIST","vendors":["Advenica","Industrial Defender","Nozomi","Replil","TXOne"],"cmode":"ALL","countries":[]},{"name":"MOHAMED YOUSSEF LHORRI","entity":null,"monthly":[6500,6500,6500,6695,6695,6695,6695,6695,6695,6695,6695,6695],"total":79755,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"ADHAM SAMY ABDELMONIEM ALY MOHAMED ELMOAZEN","entity":null,"monthly":[3922.61,3922.61,3922.61,4040.29,4040.29,4040.29,4040.29,4040.29,4040.29,4040.29,4040.29,4040.29],"total":48130.44,"vmode":"LIST","vendors":["Checkmarx","Entrust","Group IB","Harness","Invicti"],"cmode":"LIST","countries":["Levant"]},{"name":"Aaya Abdulhameed Hazim","entity":null,"monthly":[6600,6600,6600,6798,6798,6798,6798,6798,6798,6798,6798,6798],"total":80982,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Edwin Nwabueze Osiago","entity":null,"monthly":[5859,5859,5859,6034.77,6034.77,6034.77,6034.77,6034.77,6034.77,6034.77,6034.77,6034.77],"total":71889.93,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"ALL","countries":[]},{"name":"Ahmed Mansour AbdelWahab Mansour","entity":null,"monthly":[9056,9056,9056,9327.68,9327.68,9327.68,9327.68,9327.68,9327.68,9327.68,9327.68,9327.68],"total":111117.12,"vmode":"LIST","vendors":["ACCUKNOX","Ardent Privacy","Certes","Cyware","FASOO","Netskope","Netwrix"],"cmode":"LIST","countries":["KSA"]},{"name":"Basm Malk Mjbwr","entity":null,"monthly":[8000,8000,8000,8240,8240,8240,8240,8240,8240,8240,8240,8240],"total":98160,"vmode":"LIST","vendors":["Proofpoint"],"cmode":"LIST","countries":["KSA"]},{"name":"Elita Ahmed Adul Hamid Abdin","entity":null,"monthly":[1869.23,1869.23,1869.23,1925.31,1925.31,1925.31,1925.31,1925.31,1925.31,1925.31,1925.31,1925.31],"total":22935.48,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Wade Gomes","entity":null,"monthly":[13750,13750,13750,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5],"total":168712.5,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Eastern Africa"]},{"name":"MOHAMED YASSER  ZAKY ","entity":null,"monthly":[4400,4400,4400,4532,4532,4532,4532,4532,4532,4532,4532,4532],"total":53988,"vmode":"LIST","vendors":["Redseal","ThreatConnect","Utimaco","Xage"],"cmode":"LIST","countries":["Levant"]},{"name":"Parag Sadanand Mhatre","entity":null,"monthly":[7996.9,7996.9,7996.9,8236.81,8236.81,8236.81,8236.81,8236.81,8236.81,8236.81,8236.81,8236.81],"total":98121.99,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Oman","UAE"]},{"name":"Abhinaya Palani","entity":null,"monthly":[1906.06,1906.06,1906.06,1963.24,1963.24,1963.24,1963.24,1963.24,1963.24,1963.24,1963.24,1963.24],"total":23387.34,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Bishoy Saed Gaed Rasem ","entity":null,"monthly":[4000,4000,4000,4120,4120,4120,4120,4120,4120,4120,4120,4120],"total":49080,"vmode":"LIST","vendors":["Advenica","Industrial Defender","Nozomi","Replil","TXOne"],"cmode":"ALL","countries":[]},{"name":"OMAR HASSAAN MOHAMED NAGUIB MOSTAFA OMRAN","entity":null,"monthly":[4300,4300,4300,4429,4429,4429,4429,4429,4429,4429,4429,4429],"total":52761,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Ali Omar Alyounes","entity":null,"monthly":[11333.33,11333.33,11333.33,11673.33,11673.33,11673.33,11673.33,11673.33,11673.33,11673.33,11673.33,11673.33],"total":139059.96,"vmode":"LIST","vendors":["Akamai","Netskope"],"cmode":"ALL","countries":[]},{"name":"Harsha Kondadathil","entity":null,"monthly":[6041.26,6041.26,6041.26,6222.5,6222.5,6222.5,6222.5,6222.5,6222.5,6222.5,6222.5,6222.5],"total":74126.28,"vmode":"LIST","vendors":["Akamai","Entrust","Forescout","Gigamon","Xage"],"cmode":"ALL","countries":[]},{"name":"Mostafa Gamal Ramadan Taha","entity":null,"monthly":[4800,4800,4800,4944,4944,4944,4944,4944,4944,4944,4944,4944],"total":58896,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Christo Esterhuizen","entity":null,"monthly":[6622,6622,6622,6820.66,6820.66,6820.66,6820.66,6820.66,6820.66,6820.66,6820.66,6820.66],"total":81251.94,"vmode":"LIST","vendors":["Akamai","Arista","Forescout","Gigamon"],"cmode":"ALL","countries":[]},{"name":"CM Pillay","entity":null,"monthly":[13750,13750,13750,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5,14162.5],"total":168712.5,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Southern Africa"]},{"name":"Omar Chouman","entity":null,"monthly":[9999.5,9999.5,9999.5,10299.49,10299.49,10299.49,10299.49,10299.49,10299.49,10299.49,10299.49,10299.49],"total":122693.91,"vmode":"LIST","vendors":["Cribl","Elastic","Immersive Labs","Minio","Swimlane"],"cmode":"LIST","countries":["KSA"]},{"name":"Zaid Samir Omar","entity":null,"monthly":[1432.04,1432.04,1432.04,1475.0,1475.0,1475.0,1475.0,1475.0,1475.0,1475.0,1475.0,1475.0],"total":17571.12,"vmode":"LIST","vendors":["Augur Security (Seclytics)","Countercraft","Crowdstrike","Exagrid","H3/Ridge","Solarwinds","Teramind"],"cmode":"ALL","countries":[]},{"name":"Sidrah Mohammed Irfan Shaikh","entity":null,"monthly":[2514.18,2514.18,2514.18,2589.61,2589.61,2589.61,2589.61,2589.61,2589.61,2589.61,2589.61,2589.61],"total":30849.03,"vmode":"LIST","vendors":["ACCUKNOX","Ardent Privacy","Certes","Cyware","Netskope","Netwrix"],"cmode":"ALL","countries":[]},{"name":"Hend Mustafa Abbas Ahmed","entity":null,"monthly":[3321.99,3321.99,3321.99,3421.65,3421.65,3421.65,3421.65,3421.65,3421.65,3421.65,3421.65,3421.65],"total":40760.82,"vmode":"LIST","vendors":["Fortra","Hexnode","Paladin AI","Teramind"],"cmode":"ALL","countries":[]},{"name":"Ayush Bajaj Sujit Bajaj","entity":null,"monthly":[2042.21,2042.21,2042.21,2103.47,2103.47,2103.47,2103.47,2103.47,2103.47,2103.47,2103.47,2103.47],"total":25057.86,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Fady Osama William Naguib ","entity":null,"monthly":[4730,4730,4730,4871.9,4871.9,4871.9,4871.9,4871.9,4871.9,4871.9,4871.9,4871.9],"total":58037.1,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Husain Essa Husain Dahlan","entity":null,"monthly":[8680,8680,8680,8940.4,8940.4,8940.4,8940.4,8940.4,8940.4,8940.4,8940.4,8940.4],"total":106503.6,"vmode":"LIST","vendors":["Countercraft","Netwitness","Redseal","Security Scorecard","ThreatConnect","Utimaco"],"cmode":"LIST","countries":["KSA"]},{"name":"Fares Albaqami","entity":null,"monthly":[411.17,411.17,411.17,423.5,423.5,423.5,423.5,423.5,423.5,423.5,423.5,423.5],"total":5045.01,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Saad Khalid Bin Khunfur","entity":null,"monthly":[2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67,2062.67],"total":24752.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Luluh Alahmed","entity":null,"monthly":[2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67,2538.67],"total":30464.04,"vmode":"LIST","vendors":["Akamai","Arista","Forescout","Gigamon"],"cmode":"ALL","countries":[]},{"name":"ERIC KAMAMI IGECHA","entity":null,"monthly":[6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1,6040.1],"total":72481.2,"vmode":"LIST","vendors":["Advenica","Industrial Defender","Nozomi","Replil","TXOne"],"cmode":"LIST","countries":["Eastern Africa"]},{"name":"Mennatallah Mohamed Yahia","entity":null,"monthly":[850,850,850,850,850,850,850,850,850,850,850,850],"total":10200,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Reem ","entity":null,"monthly":[3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91,3276.91],"total":39322.92,"vmode":"LIST","vendors":["ACCUKNOX","Ardent Privacy","Certes","Cyware","FASOO","Netskope","Netwrix"],"cmode":"LIST","countries":["Levant"]},{"name":"Aishah Abdulaziz I Alabbad","entity":null,"monthly":[1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22,1060.22],"total":12722.64,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"ABDULRAHMAN ALI SAAD IBN HUTAYLAH ","entity":null,"monthly":[877.42,877.42,877.42,877.42,877.42,877.42,877.42,877.42,877.42,877.42,877.42,877.42],"total":10529.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"SADEEM MOHAMMED ALSUNAYTAN","entity":null,"monthly":[745.81,745.81,745.81,745.81,745.81,745.81,745.81,745.81,745.81,745.81,745.81,745.81],"total":8949.72,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Mohamed Fathi Fadel Ibrahim ","entity":null,"monthly":[1361.47,1361.47,1361.47,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31,1402.31],"total":16705.2,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Maria Clarissa Agbuya","entity":null,"monthly":[806.34,806.34,806.34,806.34,806.34,806.34,806.34,806.34,806.34,806.34,806.34,806.34],"total":9676.08,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"MARYAM ELMASHREKY","entity":null,"monthly":[888.47,888.47,888.47,888.47,888.47,888.47,888.47,888.47,888.47,888.47,888.47,888.47],"total":10661.64,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Samy Sherif Mohamed ElGhandour","entity":null,"monthly":[2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4,2564.4],"total":30772.8,"vmode":"LIST","vendors":["ACCUKNOX","Ardent Privacy","Certes","FASOO","Fortra"],"cmode":"ALL","countries":[]},{"name":"Business Development Manager  (KSA) ","entity":null,"monthly":[0,0,0,8888.89,8888.89,8888.89,8888.89,8888.89,8888.89,8888.89,8888.89,8888.89],"total":80000.01,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Business Development Manager  (Egypt) ","entity":null,"monthly":[0,0,0,4444.44,4444.44,4444.44,4444.44,4444.44,4444.44,4444.44,4444.44,4444.44],"total":39999.96,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Business Development Manager  (Morocco) ","entity":null,"monthly":[0,0,0,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67],"total":60000.03,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["French Africa"]},{"name":"Country Manager  (Kenya)","entity":null,"monthly":[6250,6250,6250,6250,6250,6250,6250,6250,6250,6250,6250,6250],"total":75000,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Eastern Africa"]},{"name":"Country Manager  (Nigeria)","entity":null,"monthly":[6250,6250,6250,6250,6250,6250,6250,6250,6250,6250,6250,6250],"total":75000,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Western Africa"]},{"name":"ICAM - (Egypt)","entity":null,"monthly":[1250,1250,1250,1250,1250,1250,1250,1250,1250,1250,1250,1250],"total":15000,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Product Manager - Geetha's BU - Pakistan ","entity":null,"monthly":[0,0,0,4000,4000,4000,4000,4000,4000,4000,4000,4000],"total":36000,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"ALL","countries":[]},{"name":"Product Manager - Geetha's BU - LENA ","entity":null,"monthly":[3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33],"total":39999.96,"vmode":"LIST","vendors":["Crowdstrike"],"cmode":"LIST","countries":["Levant"]},{"name":"Product Manager - Saif's BU - KSA ","entity":null,"monthly":[5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67],"total":65000.04,"vmode":"LIST","vendors":["Fortra","Hexnode","Paladin AI","Teramind"],"cmode":"LIST","countries":["KSA"]},{"name":"Product Manager - Saif's BU - UAE ","entity":null,"monthly":[5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67,5416.67],"total":65000.04,"vmode":"LIST","vendors":["Fortra","Hexnode","Paladin AI","Teramind"],"cmode":"LIST","countries":["UAE"]},{"name":"Product Manager - OT BU - KSA ","entity":null,"monthly":[6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67,6666.67],"total":80000.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Product Manager - Networking BU - LENA","entity":null,"monthly":[3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33],"total":39999.96,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Solutions Architect (KSA) ","entity":null,"monthly":[7733,7733,7733,7733,7733,7733,7733,7733,7733,7733,7733,7733],"total":92796,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Solutions Architect (IRAQ) ","entity":null,"monthly":[3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33],"total":39999.96,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Levant"]},{"name":"Security Consultant (Egypt)","entity":null,"monthly":[2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67,2916.67],"total":35000.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Product Associat- Samreen's BU","entity":null,"monthly":[8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67,8666.67],"total":104000.04,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Product Associat- Abdallah's BU","entity":null,"monthly":[3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33,3333.33],"total":39999.96,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Associate Security Consultant (North Africa) - Morocco","entity":null,"monthly":[1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67,1041.67],"total":12500.04,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["French Africa"]},{"name":"Associate Security Consultant (Gulf) - UAE","entity":null,"monthly":[1250,1250,1250,1250,1250,1250,1250,1250,1250,1250,1250,1250],"total":15000,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["UAE"]},{"name":"Associate Security Consultant (KSA) - KSA","entity":null,"monthly":[0,0,0,1500,1500,1500,1500,1500,1500,1500,1500,1500],"total":13500,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Associate Security Consultant (LEA) - Egypt","entity":null,"monthly":[0,0,0,0,0,0,1000,1000,1000,1000,1000,1000],"total":6000,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["Arabic Africa"]},{"name":"Associate Security Consultant (KSA) - KSA - Saudi Only","entity":null,"monthly":[1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800],"total":21600,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Associate Security Consultant (KSA) - KSA - Saudi Only","entity":null,"monthly":[1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800],"total":21600,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Associate Security Consultant (KSA) - KSA - Saudi Only","entity":null,"monthly":[1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800,1800],"total":21600,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"OT Associate Security Consultant - KSA - Saudi Only","entity":null,"monthly":[1650,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650],"total":19800,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Associate Project Manager - KSA - Saudi Only","entity":null,"monthly":[1650,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650,1650],"total":19800,"vmode":"ALL","vendors":[],"cmode":"LIST","countries":["KSA"]},{"name":"Credit & Collections - KSA","entity":null,"monthly":[4800,4800,4800,4800,4800,4800,4800,4800,4800,4800,4800,4800],"total":57600,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Collections - LEA","entity":null,"monthly":[2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33,2083.33],"total":24999.96,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Legal / Compliance - UAE","entity":null,"monthly":[0,0,0,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33],"total":74999.97,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Finance Analyst - BU Focused","entity":null,"monthly":[0,0,0,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78],"total":25000.02,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Treasury Analyst - (covering Banking & Loans) - Under Dinesh","entity":null,"monthly":[0,0,0,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78,2777.78],"total":25000.02,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]},{"name":"Marketing - Lara's request for a Team Manager","entity":null,"monthly":[0,0,0,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33,8333.33],"total":74999.97,"vmode":"ALL","vendors":[],"cmode":"ALL","countries":[]}];
// non-employee SGA categories -> [Jan..Dec] monthly $ from "Other Expenses Analysis"
const SEED_SGA = {"TOTAL RENT": [34895.79, 34895.79, 35651.94, 35651.94, 35651.94, 35651.94, 35651.94, 35651.94, 35721.24, 36645.22, 36645.22, 37231.8], "TOTAL LEGAL": [18007.89, 13923.48, 12970.45, 12562.01, 12562.01, 12970.45, 12562.01, 12562.01, 12970.45, 12562.01, 12562.01, 49307.68], "TOTAL MKTG AND SKO": [365000, 65000, 65000, 65000, 65000, 65000, 65000, 65000, 65000, 65000, 65000, 65000], "TOTAL OTHER EXPENSES": [44469.08, 44469.08, 48553.49, 44469.08, 44469.08, 44469.08, 44469.08, 44525.7, 44889.08, 44754.14, 44589.08, 101961.25]};
const DATA_QUALITY = {
  unmatchedVendorTerms: ["GRC","GTB","Horizon3","Phosphrous","Ridge Security","angur security","gtb","horizon","horizon3","netwintness","ridge security"],
  unmatchedCountryTerms: ["Gulf","North Africa","Pakistan"],
  employeesWithVendorIssue: 25,
  employeesWithCountryIssue: 11,
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_MONTH_IDX = 7; // August 2026 -> Jan..Aug actual = indices 0-7 (months 1-8)

/* ============================= FORMATTERS ============================= */
const fmtCompact = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
const fmtFull = (n) => `$${Math.round(n || 0).toLocaleString("en-US")}`;
const fmtMillions = (n) => `$${((n || 0) / 1_000_000).toFixed(2)}M`;
// toLocaleString (not toFixed) specifically so large K-unit figures get
// thousands separators (e.g. "$15,995.3K" instead of "$15995.3K") — easy
// to misread without them once a vendor/period crosses four digits in K.
const fmtThousands = (n) => `$${((n || 0) / 1_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
// User-controlled unit for chat table output (millions/thousands/full) —
// distinct from fmtCompact's auto-scaling, since here the person picks the
// unit explicitly and every number in the table should honor that choice
// consistently, not switch units row to row based on magnitude.
const fmtByUnit = (n, unit) => {
  if (n === null || n === undefined || isNaN(n)) return "";
  if (unit === "thousands") return fmtThousands(n);
  if (unit === "full") return fmtFull(n);
  return fmtMillions(n);
};
const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`;
const fmtPct1 = (n) => `${((n || 0) * 100).toFixed(1)}%`;
const fmtSignedPct = (n) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
// fmtN/fmtMillions puts the minus sign INSIDE the $ ("$-0.97M") — matches
// how the rest of the app already displays negative currency everywhere
// else, so left as-is there. Overview's KPI delta lines specifically want
// the sign outside ("-$0.97M"), so this is a scoped wrapper for just that
// spot rather than changing fmtN app-wide.
const fmtSignedN = (n, fmtN) => `${n < 0 ? "-" : ""}${fmtN(Math.abs(n))}`;

// Global unit toggle (item 5) — one shared state (App-level, provided here
// via context) drives every monetary number in the app: KPI cards, every
// table, chart axes, chat tables, diff cards, vendor history. A context
// avoids threading `numberUnit` as a prop through ~15 components for the
// ~50 call sites that display a number. Default "millions" matches what
// fmtCompact would've shown for typical vendor-sized figures anyway.
const NumberUnitContext = React.createContext({ unit: "millions", setUnit: () => {}, fmtN: fmtMillions });
const useNumberUnit = () => React.useContext(NumberUnitContext);

/* ============================= MATRIX MATH ============================= */
// A "cellsPct" object maps "month|country" -> fraction of annual revenue (sums to 1).

function buildYearMatrix(rows) {
  const total = rows.reduce((s, r) => s + r[2], 0);
  const cellsPct = {};
  for (const [m, c, rev] of rows) {
    const k = `${m}|${c}`;
    cellsPct[k] = (cellsPct[k] || 0) + (total ? rev / total : 0);
  }
  return { cellsPct, total, hasData: total > 0 };
}

function buildHybrid2026(rows2026, monthlyBudgetRevenue, fallbackCountryPct) {
  const revByCell = {};
  let total = 0;
  for (const [m, c, rev] of rows2026) {
    if (m > CURRENT_MONTH_IDX + 1) continue;
    const k = `${m}|${c}`;
    revByCell[k] = (revByCell[k] || 0) + rev;
    total += rev;
  }
  for (let m = CURRENT_MONTH_IDX + 2; m <= 12; m++) {
    const monthRev = monthlyBudgetRevenue[m - 1] || 0;
    const keys = Object.keys(fallbackCountryPct);
    for (const c of keys) {
      const v = monthRev * fallbackCountryPct[c];
      if (v <= 0) continue;
      const k = `${m}|${c}`;
      revByCell[k] = (revByCell[k] || 0) + v;
      total += v;
    }
  }
  const cellsPct = {};
  for (const k in revByCell) cellsPct[k] = total ? revByCell[k] / total : 0;
  return { cellsPct, total, hasData: total > 0 };
}

function blendMatrices(list) {
  // list: [{cellsPct, weight}]
  const out = {};
  let wsum = 0;
  for (const { cellsPct, weight } of list) {
    wsum += weight;
    for (const k in cellsPct) out[k] = (out[k] || 0) + cellsPct[k] * weight;
  }
  const s = Object.values(out).reduce((a, b) => a + b, 0) || 1;
  const norm = {};
  for (const k in out) norm[k] = out[k] / s;
  return norm;
}

function countryMarginal(cellsPct) {
  const out = {};
  for (const k in cellsPct) {
    const c = k.split("|")[1];
    out[c] = (out[c] || 0) + cellsPct[k];
  }
  return out;
}
function monthMarginal(cellsPct) {
  const out = {};
  for (const k in cellsPct) {
    const m = parseInt(k.split("|")[0], 10);
    out[m] = (out[m] || 0) + cellsPct[k];
  }
  return out;
}
function gridFromPct(cellsPct, targetRevenue) {
  const grid = {};
  for (const k in cellsPct) {
    const [m, c] = k.split("|");
    const mi = parseInt(m, 10);
    if (!grid[mi]) grid[mi] = {};
    grid[mi][c] = cellsPct[k] * targetRevenue;
  }
  return grid;
}
function gridToCellsPct(grid) {
  let total = 0;
  for (const m in grid) for (const c in grid[m]) total += grid[m][c];
  const cellsPct = {};
  for (const m in grid) for (const c in grid[m]) cellsPct[`${m}|${c}`] = total ? grid[m][c] / total : 0;
  return { cellsPct, total };
}

/* Precompute the whole-company matrices once (used as fallback for thin/new vendors) */
function buildCompanyMatrices() {
  const rows2024 = [], rows2025 = [], rows2026 = [];
  for (const vendor in VENDOR_HISTORY) {
    const yrs = VENDOR_HISTORY[vendor];
    if (yrs["2024"]) rows2024.push(...yrs["2024"]);
    if (yrs["2025"]) rows2025.push(...yrs["2025"]);
    if (yrs["2026"]) rows2026.push(...yrs["2026"]);
  }
  const m24 = buildYearMatrix(rows2024);
  const m25 = buildYearMatrix(rows2025);
  // company remaining-2026 budget = sum of every vendor's remaining monthly budget
  const remaining = [0, 0, 0, 0]; // Sep..Dec
  for (const v of SEED_VENDORS) {
    for (let i = 0; i < 4; i++) remaining[i] += v.monthly_budget_revenue[8 + i] || 0;
  }
  const countryFallback = countryMarginal(blendMatrices([{ cellsPct: m24.cellsPct, weight: 0.4 }, { cellsPct: m25.cellsPct, weight: 0.6 }]));
  const monthlyBudgetShape = [0,0,0,0,0,0,0,0, remaining[0], remaining[1], remaining[2], remaining[3]];
  const hybrid26 = buildHybrid2026(rows2026, monthlyBudgetShape, countryFallback);
  const blended = blendMatrices([
    { cellsPct: m24.cellsPct, weight: 0.20 },
    { cellsPct: m25.cellsPct, weight: 0.30 },
    { cellsPct: hybrid26.cellsPct, weight: 0.50 },
  ]);
  return { m24, m25, hybrid26, blended, countryFallback };
}

function buildVendorCandidates(vendor) {
  const hist = VENDOR_HISTORY[vendor.vendor] || {};
  const rows24 = hist["2024"] || [];
  const rows25 = hist["2025"] || [];
  const rows26 = hist["2026"] || [];
  const m24 = buildYearMatrix(rows24);
  const m25 = buildYearMatrix(rows25);

  const company = buildCompanyMatrices();
  const fallbackCountryPct = (m24.hasData || m25.hasData)
    ? countryMarginal(blendMatrices([{ cellsPct: m24.cellsPct, weight: 0.4 }, { cellsPct: m25.cellsPct, weight: 0.6 }]))
    : company.countryFallback;

  const hybrid26 = buildHybrid2026(rows26, vendor.monthly_budget_revenue, fallbackCountryPct);

  const candidates = [];
  if (m24.hasData) candidates.push({ key: "y2024", label: "2024 (actual)", cellsPct: m24.cellsPct });
  if (m25.hasData) candidates.push({ key: "y2025", label: "2025 (actual)", cellsPct: m25.cellsPct });
  if (hybrid26.hasData) candidates.push({ key: "y2026", label: "2026 (actual Jan–Aug + budget Sep–Dec)", cellsPct: hybrid26.cellsPct });

  if (m24.hasData || m25.hasData || hybrid26.hasData) {
    const parts = [];
    if (m24.hasData) parts.push({ cellsPct: m24.cellsPct, weight: 0.20 });
    if (m25.hasData) parts.push({ cellsPct: m25.cellsPct, weight: 0.30 });
    if (hybrid26.hasData) parts.push({ cellsPct: hybrid26.cellsPct, weight: 0.50 });
    candidates.push({ key: "blended", label: "Blended (recommended)", cellsPct: blendMatrices(parts), recommended: true });
  }
  candidates.push({ key: "company", label: "Company average (fallback)", cellsPct: company.blended });
  return candidates;
}

/* ============================= EBID / P&L ALLOCATION ENGINE (spec §7) ============================= */
// Non-employee SGA (rent, legal, marketing, other) allocates by GP share, company-wide.
// Employee cost allocates by GP share within each employee's own vendor list / country list
// (or company-wide GP share if the employee is "ALL vendors" / "ALL countries").
// Depreciation and interest are intentionally excluded — they sit below EBID, not allocated (spec §7.3).

function buildPLAllocation(scenarioVendors, regionRows) {
  const vendorGP = {};
  let totalGP = 0;
  for (const v of scenarioVendors) { vendorGP[v.vendor] = v.budget_gp; totalGP += v.budget_gp; }

  const countryGP = {};
  let totalCountryGP = 0;
  for (const r of regionRows) { countryGP[r.region] = r.budget_gp; totalCountryGP += r.budget_gp; }

  const nonEmpMonthly = new Array(12).fill(0);
  for (const cat in SEED_SGA) SEED_SGA[cat].forEach((v, i) => { nonEmpMonthly[i] += v; });
  const nonEmpAnnual = nonEmpMonthly.reduce((a, b) => a + b, 0);

  const vendorSGA = {}; scenarioVendors.forEach(v => vendorSGA[v.vendor] = 0);
  const countrySGA = {}; regionRows.forEach(r => countrySGA[r.region] = 0);

  // non-employee SGA, GP-share allocated
  for (const v of scenarioVendors) vendorSGA[v.vendor] += totalGP ? nonEmpAnnual * (vendorGP[v.vendor] / totalGP) : 0;
  for (const r of regionRows) countrySGA[r.region] += totalCountryGP ? nonEmpAnnual * (countryGP[r.region] / totalCountryGP) : 0;

  const empMonthlyTotal = new Array(12).fill(0);
  let unresolvedVendorCost = 0, unresolvedCountryCost = 0;

  for (const e of SEED_EMPLOYEES) {
    e.monthly.forEach((v, i) => { empMonthlyTotal[i] += v; });

    // vendor-wise
    if (e.vmode === "ALL" || !e.vendors || !e.vendors.length) {
      if (totalGP) for (const v of scenarioVendors) vendorSGA[v.vendor] += e.total * (vendorGP[v.vendor] / totalGP);
      else unresolvedVendorCost += e.total;
    } else {
      const listGP = e.vendors.reduce((s, vn) => s + (vendorGP[vn] || 0), 0);
      if (listGP > 0) for (const vn of e.vendors) vendorSGA[vn] += e.total * ((vendorGP[vn] || 0) / listGP);
      else if (totalGP) for (const v of scenarioVendors) vendorSGA[v.vendor] += e.total * (vendorGP[v.vendor] / totalGP);
    }

    // country-wise
    if (e.cmode === "ALL" || !e.countries || !e.countries.length) {
      if (totalCountryGP) for (const r of regionRows) countrySGA[r.region] += e.total * (countryGP[r.region] / totalCountryGP);
      else unresolvedCountryCost += e.total;
    } else {
      const listGP = e.countries.reduce((s, cn) => s + (countryGP[cn] || 0), 0);
      if (listGP > 0) for (const cn of e.countries) countrySGA[cn] += e.total * ((countryGP[cn] || 0) / listGP);
      else if (totalCountryGP) for (const r of regionRows) countrySGA[r.region] += e.total * (countryGP[r.region] / totalCountryGP);
    }
  }

  const vendorPL = scenarioVendors.map(v => ({
    vendor: v.vendor, revenue: v.budget_revenue, gp: v.budget_gp, sga: vendorSGA[v.vendor] || 0,
    ebid: v.budget_gp - (vendorSGA[v.vendor] || 0),
  })).sort((a, b) => b.ebid - a.ebid);

  const countryPL = regionRows.map(r => ({
    region: r.region, revenue: r.budget_revenue, gp: r.budget_gp, sga: countrySGA[r.region] || 0,
    ebid: r.budget_gp - (countrySGA[r.region] || 0),
  })).sort((a, b) => b.ebid - a.ebid);

  // company monthly P&L — GP% held constant per vendor across months (monthly GP grids aren't tracked separately, spec assumption)
  const monthlyPL = MONTHS.map((m, i) => {
    const revenue = scenarioVendors.reduce((s, v) => s + (v.monthly_budget_revenue[i] || 0), 0);
    const gp = scenarioVendors.reduce((s, v) => s + (v.monthly_budget_revenue[i] || 0) * v.gp_pct, 0);
    const sga = nonEmpMonthly[i] + empMonthlyTotal[i];
    return { month: m, revenue, gp, sga, ebid: gp - sga };
  });

  const totalSGA = nonEmpAnnual + SEED_EMPLOYEES.reduce((s, e) => s + e.total, 0);
  return { vendorPL, countryPL, monthlyPL, totalGP, totalSGA, totalEbid: totalGP - totalSGA, nonEmpAnnual, empAnnual: SEED_EMPLOYEES.reduce((s, e) => s + e.total, 0), unresolvedVendorCost, unresolvedCountryCost };
}

/* API client now lives in ./api.js (attaches Firebase auth token to every call) */

/* ============================= APP ============================= */
export default function App() {
  const [vendors, setVendors] = useState(SEED_VENDORS);
  const [scenario, setScenario] = useState("Macnica");
  const [skoUplift, setSkoUplift] = useState(0.15);
  const [tab, setTab] = useState("overview");
  // Per-tab access control ("customized login access") — null means
  // unrestricted (every current login) until getMyAccessProfile() resolves
  // and, for a restricted account, returns the specific tab ids they're
  // allowed. See firestoreData.js getMyAccessProfile for the read and
  // firestore.rules canAccessTab() for the server-side enforcement.
  // `accessProfileReady` gates rendering the sidebar/tab content at all —
  // without it, a restricted login would render every tab for one frame
  // (allowedTabs still null while the read is in flight) and then collapse
  // down to just its allowed tab(s), which reads as a bug, not a permission
  // check happening. Nothing tab-related renders until this is true.
  const [allowedTabs, setAllowedTabs] = useState(null);
  const [accessProfileReady, setAccessProfileReady] = useState(false);
  // Display name for TopBar — approvedUsers/{email}.name (set by whoever
  // approved the login), falling back to the Microsoft SSO displayName,
  // then the email's local-part, so there's always something short to
  // show instead of the full email address.
  const [myName, setMyName] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getMyAccessProfile()
      .then(({ allowedTabs, name }) => { if (!cancelled) { setAllowedTabs(allowedTabs); setMyName(name); } })
      .finally(() => { if (!cancelled) setAccessProfileReady(true); });
    return () => { cancelled = true; };
  }, []);
  const displayName = myName || auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "";
  // Belt-and-suspenders: also derived at render time (effectiveTab below) so
  // there's no single-frame mismatch between the Sidebar's filtered items
  // and which tab's content actually renders; this effect commits that
  // correction into real `tab` state so it sticks for subsequent clicks.
  useEffect(() => {
    if (allowedTabs && !allowedTabs.includes(tab)) setTab(allowedTabs[0] || "overview");
  }, [allowedTabs]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("budget_revenue");
  const [sortDir, setSortDir] = useState("desc");
  const [editingVendor, setEditingVendor] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  // Chat panel resize: drag the left edge to set a custom width; minimize
  // collapses to a slim strip; maximize jumps to a large preset width.
  // Minimize/maximize don't erase the dragged width — restoring from
  // either goes back to whatever width was set before.
  const [chatWidth, setChatWidth] = useState(340);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatMaximized, setChatMaximized] = useState(false);
  const CHAT_MIN_WIDTH = 280, CHAT_MAX_WIDTH = 760, CHAT_MAXIMIZED_WIDTH = 640, CHAT_MINIMIZED_WIDTH = 48;
  const chatDraggingRef = useRef(false);
  const effectiveChatWidth = chatMinimized ? CHAT_MINIMIZED_WIDTH : (chatMaximized ? CHAT_MAXIMIZED_WIDTH : chatWidth);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!chatDraggingRef.current) return;
      // Panel sits on the right edge, so width = distance from the mouse to the viewport's right edge.
      const newWidth = window.innerWidth - e.clientX;
      setChatWidth(Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, newWidth)));
      if (chatMaximized) setChatMaximized(false); // manual drag takes over from the maximize preset
    };
    const onMouseUp = () => {
      if (!chatDraggingRef.current) return;
      chatDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [chatMaximized]);

  const startChatResize = () => {
    if (chatMinimized) return; // nothing to drag when collapsed
    chatDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Sidebar resize/minimize/maximize — same pattern as the chat panel.
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [sidebarMaximized, setSidebarMaximized] = useState(false);
  const SIDEBAR_MIN_WIDTH = 150, SIDEBAR_MAX_WIDTH = 420, SIDEBAR_MAXIMIZED_WIDTH = 380, SIDEBAR_MINIMIZED_WIDTH = 48;
  const sidebarDraggingRef = useRef(false);
  const effectiveSidebarWidth = sidebarMinimized ? SIDEBAR_MINIMIZED_WIDTH : (sidebarMaximized ? SIDEBAR_MAXIMIZED_WIDTH : sidebarWidth);
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!sidebarDraggingRef.current) return;
      // Sidebar sits on the left edge, so width = distance from the viewport's left edge to the mouse.
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX)));
      if (sidebarMaximized) setSidebarMaximized(false); // manual drag takes over from the maximize preset
    };
    const onMouseUp = () => {
      if (!sidebarDraggingRef.current) return;
      sidebarDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [sidebarMaximized]);
  const startSidebarResize = () => {
    if (sidebarMinimized) return; // nothing to drag when collapsed
    sidebarDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", type: "text", text: "Ask me anything? What can I help you with?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [numberUnit, setNumberUnit] = useState("millions"); // "millions" | "thousands" | "full" — user-controlled, applies to chat table output
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingDiff, setPendingDiff] = useState(null);
  const [versions, setVersions] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [loadingInit, setLoadingInit] = useState(true);
  const [toast, setToast] = useState(null);
  const [planningVendor, setPlanningVendor] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const chatEndRef = useRef(null);

  // ---- Year filter (revenue/GP pages only — see firestoreData.js for the
  // read/write model). `year` defaults to the active budgeting year until
  // the real value loads from Firestore; `isEditableYear` gates every edit
  // control (inline edit, Plan FY, chat edits) — only true when the
  // selected year IS the active budgeting year.
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [activeBudgetingYear, setActiveBudgetingYearState] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const isEditableYear = activeBudgetingYear !== null && year === activeBudgetingYear;

  const companyMatrices = useMemo(() => buildCompanyMatrices(), []);

  // Initial load — pulls real state directly from Firestore (secured by
  // firestore.rules, not a REST API). Falls back to bundled seed data (and
  // shows a visible error) if Firestore is unreachable or rules reject the
  // read, so a problem doesn't just silently blank the screen.
  const [zohoRegionData, setZohoRegionData] = useState(null); // null = use client-side grid derivation (editable year); array = real Zoho region data (other years)

  const loadVendorsForYear = async (y) => {
    try {
      const vendorRows = await getVendors(y);
      if (Array.isArray(vendorRows) && vendorRows.length) setVendors(vendorRows);
      setLoadError(null);
    } catch (e) {
      setLoadError(`Couldn't reach Firestore (${e.message}). Showing bundled reference data instead of live data.`);
    }
    // Region data: real Zoho-synced totals for non-editable years (no
    // per-vendor country cross exists in that source data — see
    // firestoreData.js getRegions() for why); null for the editable year,
    // which falls back to the client-side vendor-grid derivation below.
    try {
      const currentActiveYear = activeBudgetingYear ?? (await getActiveBudgetingYear());
      if (y === currentActiveYear) {
        setZohoRegionData(null);
      } else {
        const regions = await getRegions(y);
        setZohoRegionData(regions);
      }
    } catch (e) {
      console.error(`getRegions(${y}) failed — falling back to client-side estimate:`, e);
      showToast(`Region actuals failed to load for ${y}: ${e.message} (showing an estimate instead — check console for details)`);
      setZohoRegionData(null); // fall back to client-side approximation rather than showing nothing
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [activeYear, years, versionRows] = await Promise.all([
          getActiveBudgetingYear(), getAvailableYears(), listSavedVersions(),
        ]);
        setActiveBudgetingYearState(activeYear);
        setAvailableYears(years);
        setYear(activeYear); // default view = the year currently being budgeted
        await loadVendorsForYear(activeYear);
        setVersions(versionRows || []);
      } catch (e) {
        setLoadError(`Couldn't reach Firestore (${e.message}). Showing bundled reference data instead of live data.`);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  // Re-fetch vendors whenever the year filter changes (after initial load).
  const handleYearChange = async (newYear) => {
    setYear(newYear);
    await loadVendorsForYear(newYear);
  };

  // NOTE: no more autosave-the-whole-state-blob effect here. Every mutation
  // (quick edit, vendor plan, chat-confirmed edit) now writes straight to
  // the backend at the point it happens — see applyBudgetChange /
  // applyVendorPlan below — so there's nothing to debounce-save centrally.

  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, pendingDiff]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const scenarioVendors = useMemo(() => {
    if (scenario === "Macnica") return vendors;
    return vendors.map(v => ({
      ...v,
      budget_revenue: v.budget_revenue * (1 + skoUplift),
      budget_gp: v.budget_gp * (1 + skoUplift),
      monthly_budget_revenue: v.monthly_budget_revenue.map(m => m * (1 + skoUplift)),
      // Fallback for rows without the field yet (e.g. SEED_VENDORS, the
      // bundled fallback dataset used before Firestore data has loaded, or
      // any other legacy source) — derive from revenue instead of crashing.
      monthly_budget_gp: (v.monthly_budget_gp || v.monthly_budget_revenue.map(m => m * (v.gp_pct || 0))).map(m => m * (1 + skoUplift)),
      ytd_budget_revenue: v.ytd_budget_revenue * (1 + skoUplift),
      // Real SKO actuals (from CIPR's "Included in SKO?" flag and
      // GROSS PROFIT-SKO field — see getVendors()/syncCipr) — this was
      // previously left untouched, silently showing Macnica's actuals
      // even in SKO mode. Budget-side uplift above stays an approximation
      // (SKO budget isn't separately synced from Zoho), but actuals now
      // reflect the real, different SKO figures rather than Macnica's.
      actual_revenue_ytd: v.actual_revenue_ytd_sko ?? v.actual_revenue_ytd,
      actual_gp_ytd: v.actual_gp_ytd_sko ?? v.actual_gp_ytd,
      monthly_actual_revenue: v.monthly_actual_revenue_sko || v.monthly_actual_revenue,
      monthly_actual_gp: v.monthly_actual_gp_sko || v.monthly_actual_gp,
    }));
  }, [vendors, scenario, skoUplift]);

  // Per-vendor FY System Forecast (run-rate method) — same function
  // VendorPerformanceView already uses per-row; computed once here too so
  // Overview can show a company-wide FY Forecast without re-deriving the
  // run-rate math itself.
  const enrichedVendors = useMemo(() =>
    scenarioVendors.map(v => ({ ...v, ...computeFySystemForecast(v, year) })),
    [scenarioVendors, year]
  );

  const kpis = useMemo(() => {
    const totalBudgetRev = scenarioVendors.reduce((s, v) => s + v.budget_revenue, 0);
    const totalBudgetGp = scenarioVendors.reduce((s, v) => s + v.budget_gp, 0);
    const totalYtdBudget = scenarioVendors.reduce((s, v) => s + v.ytd_budget_revenue * (scenario === "SKO" ? (1 + skoUplift) : 1), 0);
    const totalYtdBudgetGp = scenarioVendors.reduce((s, v) => s + (v.ytd_budget_gp || 0) * (scenario === "SKO" ? (1 + skoUplift) : 1), 0);
    const totalActualYtd = scenarioVendors.reduce((s, v) => s + v.actual_revenue_ytd, 0);
    const totalActualGpYtd = scenarioVendors.reduce((s, v) => s + v.actual_gp_ytd, 0);
    const varAmt = totalActualYtd - totalYtdBudget;
    const varPct = totalYtdBudget ? varAmt / totalYtdBudget : 0;
    const gpVarAmt = totalActualGpYtd - totalYtdBudgetGp;
    const gpVarPct = totalYtdBudgetGp ? gpVarAmt / totalYtdBudgetGp : 0;
    const blendedGpPct = totalBudgetRev ? totalBudgetGp / totalBudgetRev : 0;
    const actualGpPct = totalActualYtd ? totalActualGpYtd / totalActualYtd : 0;
    const totalFyForecastRev = enrichedVendors.reduce((s, v) => s + (v.fyForecastRevenue || 0), 0);
    const totalFyForecastGp = enrichedVendors.reduce((s, v) => s + (v.fyForecastGp || 0), 0);
    const forecastVarAmt = totalFyForecastRev - totalBudgetRev;
    const forecastVarPct = totalBudgetRev ? forecastVarAmt / totalBudgetRev : 0;
    const gpForecastVarAmt = totalFyForecastGp - totalBudgetGp;
    const gpForecastVarPct = totalBudgetGp ? gpForecastVarAmt / totalBudgetGp : 0;
    const forecastGpPct = totalFyForecastRev ? totalFyForecastGp / totalFyForecastRev : 0;
    const gpForecastVarPts = (forecastGpPct - blendedGpPct) * 100;
    return {
      totalBudgetRev, totalBudgetGp, totalYtdBudget, totalYtdBudgetGp, totalActualYtd, totalActualGpYtd, varAmt, varPct, gpVarAmt, gpVarPct, blendedGpPct, actualGpPct,
      totalFyForecastRev, totalFyForecastGp, forecastVarAmt, forecastVarPct, gpForecastVarAmt, gpForecastVarPct, forecastGpPct, gpForecastVarPts,
    };
  }, [scenarioVendors, enrichedVendors, scenario, skoUplift]);

  const monthlyData = useMemo(() => {
    const cutoffIdx = getActualCutoffMonthIndex(year);
    return MONTHS.map((m, i) => {
      const budget = scenarioVendors.reduce((s, v) => s + (v.monthly_budget_revenue?.[i] || 0), 0);
      const actual = i <= cutoffIdx ? scenarioVendors.reduce((s, v) => s + (v.monthly_actual_revenue?.[i] || 0), 0) : null;
      // Forecast: null through the closed months; at the cutoff month it
      // mirrors Actual so the dashed Forecast line visually picks up
      // exactly where the solid Actual line ends (no gap/jump); beyond
      // that, each vendor's own run-rate ratio (YTD actual / YTD budget)
      // applied to its own remaining-month budget phasing, summed — the
      // same math computeFySystemForecast uses for the FY total, just at
      // monthly granularity.
      let forecast = null;
      if (i === cutoffIdx) forecast = actual;
      else if (i > cutoffIdx) forecast = enrichedVendors.reduce((s, v) => s + (v.monthly_budget_revenue?.[i] || 0) * (v.runRateRatio ?? 1), 0);
      return { month: m, Budget: Math.round(budget), Actual: actual !== null ? Math.round(actual) : null, Forecast: forecast !== null ? Math.round(forecast) : null };
    });
  }, [scenarioVendors, enrichedVendors, year]);

  const monthlyGpData = useMemo(() => {
    const cutoffIdx = getActualCutoffMonthIndex(year);
    return MONTHS.map((m, i) => {
      const budgetGp = scenarioVendors.reduce((s, v) => s + (v.monthly_budget_gp?.[i] || 0), 0);
      const budgetRev = scenarioVendors.reduce((s, v) => s + (v.monthly_budget_revenue?.[i] || 0), 0);
      const actualGp = i <= cutoffIdx ? scenarioVendors.reduce((s, v) => s + (v.monthly_actual_gp?.[i] || 0), 0) : null;
      const actualRev = i <= cutoffIdx ? scenarioVendors.reduce((s, v) => s + (v.monthly_actual_revenue?.[i] || 0), 0) : null;
      let forecastGp = null;
      if (i === cutoffIdx) forecastGp = actualGp;
      else if (i > cutoffIdx) forecastGp = enrichedVendors.reduce((s, v) => s + (v.monthly_budget_gp?.[i] || 0) * (v.gpRunRateRatio ?? 1), 0);
      return {
        month: m, Budget: Math.round(budgetGp), Actual: actualGp !== null ? Math.round(actualGp) : null, Forecast: forecastGp !== null ? Math.round(forecastGp) : null,
        // Blended GP% (sum GP / sum revenue), not an average of each vendor's own %.
        "Budget GP%": budgetRev ? +(budgetGp / budgetRev * 100).toFixed(1) : 0,
        "Actual GP%": (actualRev !== null && actualRev) ? +(actualGp / actualRev * 100).toFixed(1) : null,
      };
    });
  }, [scenarioVendors, enrichedVendors, year]);

  const movers = useMemo(() => [...scenarioVendors]
    .map(v => ({ ...v, varAmt: v.actual_revenue_ytd - v.ytd_budget_revenue }))
    .sort((a, b) => Math.abs(b.varAmt) - Math.abs(a.varAmt)).slice(0, 6), [scenarioVendors]);

  // Vendors whose actual GP% is trailing their budgeted GP% — same
  // pts-behind math as computeVendorStatus's Margin Risk check, ranked
  // instead of just thresholded, for Overview's "Top Margin Detractors".
  const marginDetractors = useMemo(() => [...scenarioVendors]
    .map(v => {
      const budgetGpPct = v.budget_revenue > 0 ? v.budget_gp / v.budget_revenue : 0;
      const actualGpPct = v.actual_revenue_ytd > 0 ? v.actual_gp_ytd / v.actual_revenue_ytd : 0;
      return { ...v, gpPtsBehind: (budgetGpPct - actualGpPct) * 100 };
    })
    .filter(v => v.actual_revenue_ytd > 0 && v.gpPtsBehind > 0)
    .sort((a, b) => b.gpPtsBehind - a.gpPtsBehind)
    .slice(0, 5), [scenarioVendors]);

  // Persisted "last synced" timestamp — read back from Firestore (written
  // by syncCipr on every vendor doc, see firestoreData.js getVendors), so
  // the freshness indicator in TopBar survives a page reload instead of
  // only knowing about a sync triggered in the current browser session.
  const persistedLastSyncedAt = useMemo(() => {
    const stamps = vendors.map(v => v.last_synced_at).filter(Boolean);
    return stamps.length ? new Date(Math.max(...stamps.map(d => d.getTime()))) : null;
  }, [vendors]);


  const tableVendors = useMemo(() => {
    let rows = scenarioVendors.filter(v => v.vendor.toLowerCase().includes(search.toLowerCase()));
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }, [scenarioVendors, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const startEdit = (v) => { setEditingVendor(v.vendor); setEditValue(String(Math.round(v.budget_revenue))); };
  const commitEdit = (vendorName) => {
    const num = parseFloat(editValue.replace(/[^0-9.]/g, ""));
    if (!isNaN(num) && num >= 0) applyBudgetChange(vendorName, num, `Manually edited to ${fmtByUnit(num, numberUnit)}`);
    setEditingVendor(null);
  };

  const applyBudgetChange = (vendorName, newRevenue, note) => {
    if (!isEditableYear) {
      showToast(`${year} is read-only — editing is only enabled for the active budgeting year (${activeBudgetingYear}).`);
      return;
    }
    setVendors(prev => prev.map(v => {
      if (v.vendor !== vendorName) return v;
      const ratio = v.budget_revenue ? newRevenue / v.budget_revenue : 1;
      const nextGrid = v.country_grid ? scaleGrid(v.country_grid, ratio) : undefined;
      return {
        ...v,
        budget_revenue: newRevenue,
        budget_gp: v.budget_revenue ? v.budget_gp * ratio : newRevenue * v.gp_pct,
        monthly_budget_revenue: v.monthly_budget_revenue.map(m => m * ratio),
        ytd_budget_revenue: v.ytd_budget_revenue * ratio,
        ...(nextGrid ? { country_grid: nextGrid } : {}),
      };
    }));
    showToast(note || `Updated ${vendorName}`);
    // Optimistic UI update above; persist to backend. If this fails, the UI
    // is now out of sync with the DB until next reload — worth adding a
    // retry/rollback UX later, kept simple for now.
    quickEditVendorBudget(vendorName, newRevenue, year)
      .catch(e => showToast(`Saved locally but backend sync failed: ${e.message}`));
  };

  const applyVendorPlan = (vendorName, grid, gpPct) => {
    if (!isEditableYear) {
      showToast(`${year} is read-only — editing is only enabled for the active budgeting year (${activeBudgetingYear}).`);
      return;
    }
    let totalRev = 0;
    const monthlyRev = new Array(12).fill(0);
    for (const m in grid) {
      const mi = parseInt(m, 10) - 1;
      for (const c in grid[m]) { monthlyRev[mi] += grid[m][c]; totalRev += grid[m][c]; }
    }
    setVendors(prev => prev.map(v => {
      if (v.vendor !== vendorName) return v;
      const ytd = monthlyRev.slice(0, 8).reduce((a, b) => a + b, 0);
      return {
        ...v,
        budget_revenue: totalRev,
        budget_gp: totalRev * gpPct,
        gp_pct: gpPct,
        monthly_budget_revenue: monthlyRev,
        ytd_budget_revenue: ytd,
        country_grid: grid,
      };
    }));
    showToast(`${vendorName} FY plan applied: ${fmtByUnit(totalRev, numberUnit)} @ ${fmtPct(gpPct)} GP`);
    applyVendorPlanFn(vendorName, grid, gpPct, year)
      .catch(e => showToast(`Saved locally but backend sync failed: ${e.message}`));
  };

  const [addVendorModalOpen, setAddVendorModalOpen] = useState(false);
  const handleAddVendor = async (vendorName, startMonth) => {
    try {
      await addVendorFn(vendorName, year, startMonth);
      await loadVendorsForYear(year);
      showToast(`${vendorName} added for ${year}${startMonth > 1 ? ` (starting ${MONTHS[startMonth - 1]})` : ""}`);
      setAddVendorModalOpen(false);
    } catch (e) {
      showToast(`Couldn't add vendor: ${e.message}`);
    }
  };
  const handleRemoveVendor = async (vendorName) => {
    if (!window.confirm(`Remove ${vendorName} from the ${year} budget? This can't be undone.`)) return;
    try {
      await removeVendorFn(vendorName, year);
      await loadVendorsForYear(year);
      showToast(`${vendorName} removed from ${year}`);
    } catch (e) {
      showToast(`Couldn't remove vendor: ${e.message}`);
    }
  };

  /* ============================= CHAT ASSISTANT ============================= */
  // System prompt construction and the actual LLM call both live in the
  // `chat` Cloud Function (functions/index.js) — the API key must never
  // ship to the browser, and letting the client dictate the system prompt
  // directly would be a prompt-injection risk against our own backend. The
  // client only sends the user's message plus enough context for the
  // function to build the right prompt. httpsCallable (in chatClient.js)
  // attaches the auth token automatically — no manual header needed here.
  const callClaude = async (userText, mode, context, history) => {
    return callChat(userText, scenario, mode, { ...context, year, isEditableYear }, history);
  };

  const resolveEditValue = (vendor, parsed) => {
    const cur = vendor.budget_revenue;
    switch (parsed.mode) {
      case "set": return parsed.value;
      case "increase_pct": return cur * (1 + parsed.value);
      case "decrease_pct": return cur * (1 - parsed.value);
      case "increase_amt": return cur + parsed.value;
      case "decrease_amt": return cur - parsed.value;
      default: return cur;
    }
  };

  // Soft interrupt: httpsCallable can't truly cancel a request already in
  // flight server-side, so "stop" means: mark this request as abandoned,
  // immediately free up the UI, and silently discard the result whenever
  // it does eventually arrive rather than displaying it.
  const chatActiveRequestRef = useRef(null);
  const stopChat = () => {
    chatActiveRequestRef.current = null;
    setChatLoading(false);
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    // Conversation memory: send everything said so far (oldest first),
    // excluding the message about to be sent (that goes as `message`
    // separately) — see functions/index.js's chat function for how this
    // gets converted into Gemini's `contents` format. Table/diff messages
    // carry their own `text` summary specifically so they contribute
    // correctly here, not just in the UI.
    const historyForBackend = chatMessages.filter(m => m.text).map(m => ({ role: m.role, text: m.text }));
    setChatMessages(m => [...m, { role: "user", type: "text", text }]);
    setChatInput("");
    setChatLoading(true);
    const requestId = {};
    chatActiveRequestRef.current = requestId;
    try {
      const parsed = await callClaude(text, undefined, undefined, historyForBackend);
      if (chatActiveRequestRef.current !== requestId) return; // stopped, or superseded by a newer send — discard
      if (parsed.type === "edit") {
        const vendor = vendors.find(v => v.vendor.toLowerCase() === parsed.vendor.toLowerCase());
        if (!vendor) {
          setChatMessages(m => [...m, { role: "assistant", type: "text", text: `I couldn't match "${parsed.vendor}" to a vendor.` }]);
        } else {
          const newVal = resolveEditValue(vendor, parsed);
          const newGp = vendor.budget_revenue ? vendor.budget_gp * (newVal / vendor.budget_revenue) : newVal * vendor.gp_pct;
          setPendingDiff({ vendor: vendor.vendor, oldRevenue: vendor.budget_revenue, newRevenue: newVal, oldGp: vendor.budget_gp, newGp, explanation: parsed.explanation });
          setChatMessages(m => [...m, {
            role: "assistant", type: "diff",
            text: `Proposed: ${vendor.vendor} budget → ${fmtByUnit(newVal, numberUnit)}${parsed.explanation ? ` — ${parsed.explanation}` : ""}`,
          }]);
        }
      } else if (parsed.type === "table") {
        setChatMessages(m => [...m, {
          role: "assistant", type: "table", text: parsed.message,
          table: { title: parsed.title, columns: parsed.columns || [], rows: parsed.rows || [] },
        }]);
      } else if (parsed.type === "answer" || parsed.type === "clarify") {
        setChatMessages(m => [...m, { role: "assistant", type: "text", text: parsed.message }]);
      } else {
        setChatMessages(m => [...m, { role: "assistant", type: "text", text: "I didn't quite catch that — try rephrasing, e.g. \"set Netskope to 8M\"." }]);
      }
    } catch (e) {
      if (chatActiveRequestRef.current !== requestId) return;
      setChatMessages(m => [...m, { role: "assistant", type: "text", text: "Something went wrong reaching the assistant. Please try again." }]);
    } finally {
      if (chatActiveRequestRef.current === requestId) setChatLoading(false);
    }
  };

  // Edit-and-resubmit: populate the input with a past user message and
  // remove it plus everything after it, so resending regenerates from
  // that point instead of appending a duplicate.
  const editUserMessage = (index) => {
    const msg = chatMessages[index];
    if (!msg || msg.role !== "user") return;
    setChatInput(msg.text || "");
    setChatMessages(prev => prev.slice(0, index));
  };

  // New chat: every message sent so far gets resent as history on each
  // turn (see sendChat's historyForBackend), so a long-running
  // conversation keeps growing the tokens sent on every subsequent
  // message. Starting fresh resets that back to zero.
  const newChat = () => {
    stopChat(); // discard anything still in flight from the old conversation
    setChatMessages([{ role: "assistant", type: "text", text: "Ask me anything? What can I help you with?" }]);
    setChatInput("");
    setPendingDiff(null);
  };

  const confirmDiff = () => {
    if (!pendingDiff) return;
    applyBudgetChange(pendingDiff.vendor, pendingDiff.newRevenue, `${pendingDiff.vendor} budget updated to ${fmtByUnit(pendingDiff.newRevenue, numberUnit)}`);
    setChatMessages(m => [...m, { role: "assistant", type: "text", text: `Applied ✓ ${pendingDiff.vendor} budget is now ${fmtByUnit(pendingDiff.newRevenue, numberUnit)}.` }]);
    setPendingDiff(null);
  };
  const cancelDiff = () => {
    setChatMessages(m => [...m, { role: "assistant", type: "text", text: "Discarded — no changes made." }]);
    setPendingDiff(null);
  };

  /* ============================= VERSIONING ============================= */
  const saveVersion = async () => {
    const name = versionName.trim() || `Version ${versions.length + 1}`;
    try {
      const created = await saveVersionFn(name, auth.currentUser?.email);
      setVersions([created, ...versions]);
      showToast(`Saved "${name}"`);
    } catch (e) {
      showToast(`Couldn't save version: ${e.message}`);
    }
    setSaveModalOpen(false); setVersionName("");
  };
  const loadVersion = async (id) => {
    try {
      await loadVersionFn(id);
      await loadVendorsForYear(year);
      showToast("Version loaded");
      setTab("overview");
    } catch (e) {
      showToast(`Couldn't load that version: ${e.message}`);
    }
  };
  // Syncs actuals for whichever year is currently selected — for the
  // current year this is an ongoing refresh (new invoices since last
  // sync); for a past year it's typically a one-time backfill (past
  // actuals don't change once synced). Same button either way — no
  // separate "backfill" action needed.
  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncCiprNow(year);
      await loadVendorsForYear(year);
      setLastSyncedAt(new Date(result.syncedAt));
      showToast(`Synced ${result.vendorsUpdated} vendors for ${result.year} from Zoho — as of ${new Date(result.syncedAt).toLocaleTimeString()}`);
    } catch (e) {
      showToast(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  /* ---- Region aggregation: real Zoho data for non-editable years; each
     vendor's own Plan-FY grid (falling back to company historical split)
     for the editable year, where per-vendor country data genuinely exists ---- */
  const regionRows = useMemo(() => {
    if (zohoRegionData) return zohoRegionData; // real synced data — see loadVendorsForYear
    // Editable year only reaches here — it genuinely has no actuals yet
    // (it's a future budgeting year), so start every region at 0 rather
    // than seeding from SEED_REGIONS' bundled actual figures, which were
    // frozen 2026 numbers and would show up regardless of which year was
    // actually selected. SEED_REGIONS' region NAMES (not its numbers) are
    // still useful as a starting list so known regions appear even before
    // any vendor has a country_grid — see the initial loop below.
    const totals = {};
    for (const r of SEED_REGIONS) totals[r.region] = { budget_revenue: 0, budget_gp: 0, actual_revenue_ytd: 0, actual_gp_ytd: 0 };
    for (const v of scenarioVendors) {
      if (v.country_grid) {
        for (const m in v.country_grid) for (const c in v.country_grid[m]) {
          if (!totals[c]) totals[c] = { budget_revenue: 0, budget_gp: 0, actual_revenue_ytd: 0, actual_gp_ytd: 0 };
          totals[c].budget_revenue += v.country_grid[m][c];
          totals[c].budget_gp += v.country_grid[m][c] * v.gp_pct;
        }
      } else {
        for (const c in companyMatrices.countryFallback) {
          const pct = companyMatrices.countryFallback[c];
          if (!totals[c]) totals[c] = { budget_revenue: 0, budget_gp: 0, actual_revenue_ytd: 0, actual_gp_ytd: 0 };
          totals[c].budget_revenue += v.budget_revenue * pct;
          totals[c].budget_gp += v.budget_gp * pct;
        }
      }
    }
    return Object.entries(totals).map(([region, d]) => ({ region, ...d })).sort((a, b) => b.budget_revenue - a.budget_revenue);
  }, [scenarioVendors, companyMatrices, zohoRegionData]);

  const plAllocation = useMemo(() => buildPLAllocation(scenarioVendors, regionRows), [scenarioVendors, regionRows]);

  // What actually renders (Sidebar highlight + main content switch) — not
  // just raw `tab` state, so there's no frame where they disagree while the
  // redirect effect above catches up.
  const effectiveTab = (allowedTabs && !allowedTabs.includes(tab)) ? (allowedTabs[0] || "overview") : tab;

  /* ============================= RENDER ============================= */
  return (
    <NumberUnitContext.Provider value={{ unit: numberUnit, setUnit: setNumberUnit, fmtN: (n) => fmtByUnit(n, numberUnit) }}>
    <div style={styles.appRoot}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body, html { margin:0; padding:0; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input:focus, button:focus { outline: 2px solid #C00000; outline-offset: 1px; }
        .num { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .tab-btn { transition: all .15s ease; }
        .row-hover:hover { background: #F0F0F0 !important; }
        .chat-msg-user:hover .chat-edit-btn { opacity: 1 !important; }
        @keyframes slideUp { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:translateY(0);} }
        @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>

      <div>
        <TopBar
          scenario={scenario} setScenario={setScenario} skoUplift={skoUplift} onSave={() => setSaveModalOpen(true)} onSync={syncNow} syncing={syncing}
          year={year} activeBudgetingYear={activeBudgetingYear} lastSyncedAt={lastSyncedAt || persistedLastSyncedAt}
          availableYears={availableYears} onYearChange={handleYearChange} isEditableYear={isEditableYear} displayName={displayName}
        />
      </div>

      <div style={styles.body}>
        {/* Nothing tab-related renders until the access profile has loaded —
            otherwise a restricted login would flash every tab for one frame
            (allowedTabs still null while that read is in flight) before
            collapsing to just its allowed tab(s). */}
        {!accessProfileReady ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: 60, fontSize: 13, color: "#8A8A8A" }}>Loading…</div>
        ) : (
          <>
        <Sidebar
          tab={effectiveTab} setTab={setTab} versionsCount={versions.length} allowedTabs={allowedTabs}
          width={effectiveSidebarWidth} onStartResize={startSidebarResize}
          minimized={sidebarMinimized} onToggleMinimize={() => setSidebarMinimized(v => !v)}
          maximized={sidebarMaximized} onToggleMaximize={() => setSidebarMaximized(v => !v)}
        />

        <main style={styles.main}>
          {effectiveTab === "overview" && (
            <OverviewTab
              kpis={kpis} monthlyData={monthlyData} monthlyGpData={monthlyGpData} scenario={scenario} activeBudgetingYear={activeBudgetingYear}
              year={year} movers={movers} marginDetractors={marginDetractors} onNavigate={setTab}
            />
          )}
          {effectiveTab === "vendors" && (
            isEditableYear ? (
              <VendorsTab
                rows={tableVendors} search={search} setSearch={setSearch}
                sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort}
                editingVendor={editingVendor} editValue={editValue} setEditValue={setEditValue}
                startEdit={startEdit} commitEdit={commitEdit} setEditingVendor={setEditingVendor}
                onPlan={(v) => setPlanningVendor(v)}
                isEditableYear={isEditableYear} activeBudgetingYear={activeBudgetingYear}
                onAddVendorClick={() => setAddVendorModalOpen(true)} onRemoveVendor={handleRemoveVendor}
              />
            ) : (
              <VendorPerformanceView vendors={scenarioVendors} year={year} showToast={showToast} activeBudgetingYear={activeBudgetingYear} />
            )
          )}
          {effectiveTab === "regions" && (
            isEditableYear
              ? <RegionsTab regions={regionRows} />
              : <RegionPerformanceView year={year} showToast={showToast} activeBudgetingYear={activeBudgetingYear} scenario={scenario} />
          )}
          {effectiveTab === "pl" && <PLTab alloc={plAllocation} />}
          {effectiveTab === "otherExpenses" && <OtherExpensesTab showToast={showToast} year={year} isEditableYear={isEditableYear} activeBudgetingYear={activeBudgetingYear} />}
          {effectiveTab === "cashFlow" && <CashFlowTab showToast={showToast} year={year} />}
          {effectiveTab === "employees" && <EmployeesTab showToast={showToast} year={year} />}
          {effectiveTab === "assumptions" && <AssumptionsTab showToast={showToast} skoUplift={skoUplift} />}
          {effectiveTab === "operationalStats" && <OperationalStatsTab showToast={showToast} year={year} />}
          {effectiveTab === "versions" && <VersionsTab versions={versions} onLoad={loadVersion} onSaveClick={() => setSaveModalOpen(true)} activeBudgetingYear={activeBudgetingYear} showToast={showToast} onRefreshCurrentYear={() => loadVendorsForYear(year)} />}
        </main>
          </>
        )}

        {/* Chat assistant is hidden entirely for a restricted (customized-access)
            login, not just closed by default. Sir Slice-a-Lot's backend calls
            the chat Cloud Function with the Admin SDK, which bypasses
            firestore.rules (including canAccessTab) — so a restricted account
            could otherwise ask it about data behind a tab it can't see. Full
            fix would be teaching the chat function about allowedTabs too;
            hiding the panel closes the obvious path in the meantime. */}
        {accessProfileReady && !allowedTabs && chatOpen && (
          <ChatPanel
            messages={chatMessages} input={chatInput} setInput={setChatInput}
            onSend={sendChat} onStop={stopChat} loading={chatLoading}
            pendingDiff={pendingDiff} onConfirm={confirmDiff} onCancel={cancelDiff}
            chatEndRef={chatEndRef} onClose={() => setChatOpen(false)}
            width={effectiveChatWidth} onStartResize={startChatResize}
            minimized={chatMinimized} onToggleMinimize={() => setChatMinimized(v => !v)}
            maximized={chatMaximized} onToggleMaximize={() => setChatMaximized(v => !v)}
            onEditMessage={editUserMessage} onNewChat={newChat}
          />
        )}
      </div>

      {accessProfileReady && !allowedTabs && !chatOpen && (
        <button onClick={() => setChatOpen(true)} style={styles.chatFab} aria-label="Open budget assistant"><Terminal size={20} /></button>
      )}

      {saveModalOpen && <SaveModal versionName={versionName} setVersionName={setVersionName} onCancel={() => setSaveModalOpen(false)} onSave={saveVersion} />}

      {addVendorModalOpen && <AddVendorModal onCancel={() => setAddVendorModalOpen(false)} onAdd={handleAddVendor} year={year} />}

      {planningVendor && (
        <VendorPlannerModal
          vendor={planningVendor}
          onClose={() => setPlanningVendor(null)}
          onApply={(grid, gpPct) => { applyVendorPlan(planningVendor.vendor, grid, gpPct); setPlanningVendor(null); }}
          callClaude={callClaude}
          year={year}
        />
      )}

      {loadError && <div style={styles.loadErrorBanner}>{loadError}</div>}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
    </NumberUnitContext.Provider>
  );
}

function scaleGrid(grid, ratio) {
  const out = {};
  for (const m in grid) { out[m] = {}; for (const c in grid[m]) out[m][c] = grid[m][c] * ratio; }
  return out;
}

/* ============================= TOP-LEVEL SUBCOMPONENTS ============================= */

function TopBar({ scenario, setScenario, skoUplift, onSave, onSync, syncing, year, activeBudgetingYear, lastSyncedAt, availableYears, onYearChange, isEditableYear, displayName }) {
  const { unit, setUnit } = useNumberUnit();
  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const shortDateLabel = today.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const cutoffIdx = getActualCutoffMonthIndex(year);
  return (
    <header style={{ ...styles.topBar, flexWrap: "wrap", rowGap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={styles.logoMark}>CK</div>
        <div>
          <div style={styles.brandTitle}>Cyberknight Budget Desk</div>
          <div style={{ ...styles.brandSub, fontWeight: 700 }}>Revenue, GP &amp; Performance Intelligence</div>
          <div style={styles.brandSub}>{todayLabel}</div>
          {/* Explicit freshness line — so it's clear at a glance whether the
              numbers on screen are current, without hunting for the sync
              icon. cutoffIdx can be -1 (no closed months yet, e.g. a future
              year not underway) — guarded to avoid an "Actuals through
              undefined" label in that case. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#8A8A8A", marginTop: 2 }}>
            <span>Data as of {shortDateLabel}</span>
            <Info size={11} style={{ flexShrink: 0 }} title="Today's date — the app doesn't back-date figures; every number reflects data synced as of this moment." />
            {cutoffIdx >= 0 && (<><span>|</span><span>Actuals through {MONTHS[cutoffIdx]} {year}</span></>)}
          </div>
        </div>
      </div>

      <YearSelector year={year} availableYears={availableYears} onYearChange={onYearChange} isEditableYear={isEditableYear} activeBudgetingYear={activeBudgetingYear} />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={styles.unitToggle} title="Number display unit — applies everywhere">
          {[["millions", "M"], ["thousands", "K"], ["full", "Full"]].map(([val, label]) => (
            <button key={val} onClick={() => setUnit(val)} style={{ ...styles.unitToggleBtn, ...(unit === val ? styles.unitToggleBtnActive : {}) }} title={`Show all figures in ${val}`}>{label}</button>
          ))}
        </div>
        <div style={styles.scenarioToggle}>
          <button onClick={() => setScenario("Macnica")} style={{ ...styles.scenarioBtn, ...(scenario === "Macnica" ? styles.scenarioBtnActive : {}) }}>Macnica</button>
          <button onClick={() => setScenario("SKO")} style={{ ...styles.scenarioBtn, ...(scenario === "SKO" ? { ...styles.scenarioBtnActive, background: "#111111", color: "#FFFFFF" } : {}) }}>SKO (+{Math.round(skoUplift * 100)}%)</button>
        </div>
        <button onClick={onSave} style={styles.primaryBtn}><Save size={15} style={{ marginRight: 6 }} /> Save Version</button>
        {auth.currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 6, paddingLeft: 10, borderLeft: "1px solid #E0E0E0" }}>
            <span style={{ fontSize: 12, color: "#6B6B6B" }}>{displayName}</span>
            <button onClick={signOutUser} style={styles.iconBtnGhost} title="Sign out">⎋</button>
          </div>
        )}
        {/* Sync cluster — rightmost element in the bar. Button on top,
            persisted "Last synced" timestamp underneath (prefers this
            session's own sync click; falls back to lastSyncedAt read back
            from Firestore, written by syncCipr, so it survives a reload
            instead of resetting to "not synced" every time). */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 6, paddingLeft: 10, borderLeft: "1px solid #E0E0E0" }}>
          <button
            onClick={onSync} disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1.5px solid #2E5FA3", color: "#2E5FA3", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: syncing ? "default" : "pointer" }}
            title={`Pull latest actuals for ${year} from Zoho Analytics — manual only, no automatic schedule`}
          >
            <RefreshCw size={14} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
            Sync Now
          </button>
          <div style={{ fontSize: 10, color: "#8A8A8A", whiteSpace: "nowrap" }}>
            {lastSyncedAt ? `Last synced: ${lastSyncedAt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}, ${lastSyncedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : "Not synced yet"}
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ tab, setTab, versionsCount, allowedTabs, width, onStartResize, minimized, onToggleMinimize, maximized, onToggleMaximize }) {
  // Order + icons chosen with the user (2026-08-24): grouped roughly
  // planning -> actuals/cost -> reference, icons are real lucide-react
  // components so there's no separate icon set to maintain. "Employees"
  // relabeled "HR Budgeting" per the same request — id stays "employees"
  // so it doesn't touch any state/routing logic elsewhere.
  const allItems = [
    { id: "overview", label: "Overview", Icon: LayoutDashboard },
    { id: "vendors", label: "Vendors", Icon: Building2 },
    { id: "regions", label: "Regions", Icon: Globe },
    { id: "otherExpenses", label: "Other Expenses", Icon: Receipt },
    { id: "employees", label: "HR Budgeting", Icon: Users },
    { id: "cashFlow", label: "Cash Flow", Icon: Wallet },
    { id: "pl", label: "P&L / EBID", Icon: PieChartIcon },
    { id: "operationalStats", label: "Operational Stats", Icon: BarChart3 },
    { id: "assumptions", label: "Assumptions", Icon: ClipboardList },
    { id: "versions", label: `Versions${versionsCount ? ` (${versionsCount})` : ""}`, Icon: History },
  ];
  // Customized login access: allowedTabs === null means unrestricted (every
  // login today, unless someone explicitly sets it on that person's
  // approvedUsers doc) — see getMyAccessProfile in firestoreData.js.
  const items = allowedTabs ? allItems.filter(it => allowedTabs.includes(it.id)) : allItems;
  return (
    <nav style={{ ...styles.sidebar, width, flexShrink: 0, position: "relative", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: minimized ? "center" : "flex-end", gap: 4, marginBottom: 8 }}>
        {!minimized && (
          <button onClick={onToggleMaximize} style={styles.iconBtnGhost} title={maximized ? "Restore size" : "Maximize"}>
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
        <button onClick={onToggleMinimize} style={styles.iconBtnGhost} title={minimized ? "Restore" : "Minimize"}>
          {minimized ? <ChevronRight size={14} /> : <Minus size={14} />}
        </button>
      </div>

      {minimized ? (
        // Collapsed strip — just the icon, no label; click to get the full
        // list back. Active state matches the expanded list's blush-red
        // treatment rather than the old plain black/white invert.
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {items.map(it => (
            <button key={it.id} onClick={() => setTab(it.id)} title={it.label} style={{ ...styles.iconBtnGhost, ...(tab === it.id ? { background: "#F8E3E1", color: "#B4231E", borderColor: "#F3D2CE" } : {}) }}>
              <it.Icon size={15} />
            </button>
          ))}
        </div>
      ) : (
        <>
          {items.map(it => {
            const active = tab === it.id;
            return (
              <button key={it.id} className="tab-btn" onClick={() => setTab(it.id)} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}>
                <it.Icon size={16} style={{ flexShrink: 0, color: active ? "#B4231E" : "#8A8A8A" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              </button>
            );
          })}
          <div style={styles.sidebarFootnote}>
            Data sources — CIPR and budget files from Zoho Analytics.
          </div>
        </>
      )}

      {/* Drag handle on the right edge to resize — same pattern as the chat panel's left-edge handle. */}
      {!minimized && (
        <div onMouseDown={onStartResize} style={{ position: "absolute", right: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 5 }} title="Drag to resize" />
      )}
    </nav>
  );
}

// Shared good/neutral/bad palette for the optional icon badge + pill below
// — used by Overview's KPI tiles today; any other KpiCard caller that
// starts passing icon/pill gets the same treatment for free.
const KPI_TIER_COLORS = {
  good: { fg: "#1B8A3A", bg: "#E8F5E9" },
  neutral: { fg: "#9A6B12", bg: "#FFF3DC" },
  bad: { fg: "#C0392B", bg: "#FBE3E1" },
};

// `icon`/`iconTier`/`pill`/`pillTier` are all optional — every existing
// caller (P&L, Employees, Operational Stats, Cash Flow) renders exactly as
// before when they're omitted.
// `subLine2` is a second, more muted line below `sub` — e.g. the
// "vs YTD Plan ($99.10M)" baseline reference under a "$20.50M (+20.7%)"
// delta line. Optional; existing callers that only pass `sub` are
// unaffected.
function KpiCard({ label, value, sub, subLine2, trend, icon: Icon, iconTier, pill, pillTier }) {
  const tier = iconTier || (trend === "up" ? "good" : trend === "down" ? "bad" : null);
  const tierColors = tier ? KPI_TIER_COLORS[tier] : null;
  return (
    <div style={{ ...styles.kpiCard, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.kpiLabel}>{label}</div>
        <div className="num" style={styles.kpiValue}>{value}</div>
        {sub && (
          <div style={{ ...styles.kpiSub, color: trend === "up" ? "#1B8A3A" : trend === "down" ? "#C00000" : "#6B6B6B" }}>
            {trend === "up" && <TrendingUp size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
            {trend === "down" && <TrendingDown size={13} style={{ marginRight: 4, verticalAlign: -2 }} />}
            {sub}
          </div>
        )}
        {subLine2 && <div style={{ fontSize: 11, color: "#8A8A8A", marginTop: 2 }}>{subLine2}</div>}
        {pill && (
          <div style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: KPI_TIER_COLORS[pillTier || "neutral"].fg, background: KPI_TIER_COLORS[pillTier || "neutral"].bg }}>
            {pill}
          </div>
        )}
      </div>
      {Icon && tierColors && (
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: tierColors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} color={tierColors.fg} />
        </div>
      )}
    </div>
  );
}

function YearSelector({ year, availableYears, onYearChange, isEditableYear, activeBudgetingYear }) {
  const yearLabel = (y) => {
    if (y === activeBudgetingYear) return " (Current Budgeting Year)";
    if (y > activeBudgetingYear) return " (Future Budgeting Year)";
    return "";
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6B6B" }}>Year</label>
      <select value={year} onChange={(e) => onYearChange(parseInt(e.target.value, 10))} style={styles.yearSelect}>
        {availableYears.map(y => (
          <option key={y} value={y}>{y}{yearLabel(y)}</option>
        ))}
      </select>
      {!isEditableYear && (
        <span style={{ fontSize: 11.5, color: "#8A6D1A", background: "#FFF8E1", border: "1px solid #E8C468", borderRadius: 6, padding: "3px 8px" }} title={`Editing is only enabled for ${activeBudgetingYear}.`}>
          Sourced from Zoho
        </span>
      )}
    </div>
  );
}

// Minimize collapses the panel to just its title bar. Maximize toggles
// between the default chart height and a taller one for closer reading —
// full-viewport/modal maximize wasn't needed since panels are already
// full main-content width; height was the only real constraint. Each
// panel manages its own state independently (minimizing Revenue doesn't
// affect GP). `children` is a render-prop receiving the current height,
// so callers can pass it straight into <ResponsiveContainer height={...}>.
function CollapsiblePanel({ title, children, defaultHeight = 280, maximizedHeight = 520 }) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const height = maximized ? maximizedHeight : defaultHeight;
  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: minimized ? 0 : 14 }}>
        <div style={{ ...styles.panelTitle, marginBottom: 0 }}>{title}</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setMinimized(v => !v)} style={styles.panelIconBtn} title={minimized ? "Restore" : "Minimize"}>
            {minimized ? <ChevronDown size={14} /> : <Minus size={14} />}
          </button>
          <button onClick={() => setMaximized(v => !v)} style={{ ...styles.panelIconBtn, ...(minimized ? { opacity: 0.35, cursor: "not-allowed" } : {}) }} disabled={minimized} title={maximized ? "Restore size" : "Maximize"}>
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      {!minimized && children(height)}
    </div>
  );
}

// good/neutral/bad classification + short tagline for the revenue KPI
// tiles (icon badge color, pill color+text). Reuses the SAME achievement
// thresholds computeVendorStatus already uses per-vendor (80%/95%
// revenue-achievement -> Needs Attention/Watch/On Track), just expressed
// as variance % instead of an achievement ratio, so tile coloring stays
// consistent with the rest of the app rather than inventing new numbers.
function revenueOutlook(varPct, label) {
  if (varPct <= -0.20) return { tier: "bad", text: `Trailing ${label}` };
  if (varPct <= -0.05) return { tier: "neutral", text: `Tracking below ${label}` };
  if (varPct >= 0.05) return { tier: "good", text: `On track to exceed ${label}` };
  return { tier: "good", text: `Tracking close to ${label}` };
}
// Same idea for the GP-margin KPI tiles, reusing computeVendorStatus's
// own 3-point GP-gap threshold (Margin Risk) instead of a new one.
function gpOutlook(gpDiffPts, label) {
  if (gpDiffPts >= 0) return { tier: "good", text: `${gpDiffPts.toFixed(1)} pts ahead of ${label}` };
  if (gpDiffPts >= -3) return { tier: "neutral", text: `${Math.abs(gpDiffPts).toFixed(1)} pts below ${label}` };
  return { tier: "bad", text: `${Math.abs(gpDiffPts).toFixed(1)} pts below ${label}` };
}
// Deterministic (not AI-generated) headline for the Management Snapshot —
// built from the sign/magnitude of revenue and GP variance.
function buildSnapshotHeadline(kpis) {
  const revUp = kpis.varPct >= 0.02, revDown = kpis.varPct <= -0.02;
  const gpBehind = kpis.actualGpPct < kpis.blendedGpPct - 0.003; // >0.3pt behind
  if (revUp && gpBehind) return "Revenue is ahead of plan, but margin is under pressure.";
  if (revUp && !gpBehind) return "Revenue and margin are both tracking ahead of plan.";
  if (revDown && gpBehind) return "Revenue and margin are both trailing plan.";
  if (revDown && !gpBehind) return "Revenue is trailing plan, though margin is holding up.";
  return "Revenue and margin are tracking close to plan.";
}
// Custom dot renderer for the Actual line — draws every closed month's
// point at normal size, and an emphasized larger marker only at the last
// closed month (cutoffIdx), so the eye lands on exactly where "actual"
// stops and "forecast" takes over. Only meaningful for the Monthly view,
// which is the only one keyed by a real month index.
function actualEndpointDot(cutoffIdx, viewMode) {
  if (viewMode !== "monthly") return { r: 3 };
  return (props) => {
    const { cx, cy, index, value, stroke } = props;
    if (value === null || value === undefined || cx == null || cy == null) return null;
    const isLast = index === cutoffIdx;
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={isLast ? 5.5 : 2.5} fill={isLast ? stroke : "#FFFFFF"} stroke={stroke} strokeWidth={isLast ? 2 : 1.5} />;
  };
}

function OverviewTab({ kpis, monthlyData, monthlyGpData, scenario, activeBudgetingYear, year, movers, marginDetractors, onNavigate }) {
  const { fmtN, unit } = useNumberUnit();
  const [viewMode, setViewMode] = useState("monthly"); // "monthly" | "quarterly" | "yearly"
  const [yearlyRaw, setYearlyRaw] = useState(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [regionMovers, setRegionMovers] = useState(null);
  const [regionLoading, setRegionLoading] = useState(true);

  // Yearly is a genuinely different data shape (multi-year totals, not a
  // breakdown of the currently-selected year) — fetched lazily, only once
  // the user actually switches to it, so the default Monthly view doesn't
  // pay for 5 years of vendor data on every page load.
  useEffect(() => {
    if (viewMode !== "yearly" || yearlyRaw || yearlyLoading) return;
    setYearlyLoading(true);
    (async () => {
      try {
        const endYear = activeBudgetingYear || new Date().getFullYear() + 1;
        const years = Array.from({ length: 5 }, (_, i) => endYear - 4 + i);
        const results = await Promise.all(years.map(y => getVendors(y).catch(() => [])));
        setYearlyRaw(years.map((y, i) => {
          const rows = results[i];
          return {
            year: String(y),
            budgetRevenue: rows.reduce((s, v) => s + v.budget_revenue, 0),
            actualRevenue: rows.reduce((s, v) => s + v.actual_revenue_ytd, 0),
            budgetGp: rows.reduce((s, v) => s + v.budget_gp, 0),
            actualGp: rows.reduce((s, v) => s + v.actual_gp_ytd, 0),
          };
        }));
      } catch (e) {
        console.error("OverviewTab yearly fetch failed:", e);
      } finally {
        setYearlyLoading(false);
      }
    })();
  }, [viewMode, activeBudgetingYear]);

  // Top Regions for Key Drivers — lazy-fetched the same way the yearly
  // view above is: region performance isn't part of the company-wide
  // vendor aggregation App() already computes, so it's fetched here,
  // ranked by $ delta vs YTD plan (same idea as `movers` for vendors).
  useEffect(() => {
    let cancelled = false;
    setRegionLoading(true);
    getRegionPerformanceData(year, "region", scenario)
      .then(rows => {
        if (cancelled) return;
        const ranked = [...rows]
          .map(r => ({ ...r, varAmt: r.actual_revenue_ytd - r.ytd_budget_revenue }))
          .sort((a, b) => Math.abs(b.varAmt) - Math.abs(a.varAmt))
          .slice(0, 5);
        setRegionMovers(ranked);
      })
      .catch(e => { console.error("OverviewTab region fetch failed:", e); if (!cancelled) setRegionMovers([]); })
      .finally(() => { if (!cancelled) setRegionLoading(false); });
    return () => { cancelled = true; };
  }, [year, scenario]);

  const QUARTERS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
  const quarterlyData = useMemo(() => QUARTERS.map((idxs, qi) => {
    const budget = idxs.reduce((s, i) => s + (monthlyData[i]?.Budget || 0), 0);
    const actualVals = idxs.map(i => monthlyData[i]?.Actual);
    const hasActual = actualVals.some(v => v !== null && v !== undefined);
    const actual = hasActual ? actualVals.reduce((s, v) => s + (v || 0), 0) : null;
    const forecastVals = idxs.map(i => monthlyData[i]?.Forecast);
    const hasForecast = forecastVals.some(v => v !== null && v !== undefined);
    const forecast = hasForecast ? forecastVals.reduce((s, v) => s + (v || 0), 0) : null;
    return { month: `Q${qi + 1}`, Budget: Math.round(budget), Actual: actual !== null ? Math.round(actual) : null, Forecast: forecast !== null ? Math.round(forecast) : null };
  }), [monthlyData]);

  // Blended quarterly GP% (sum GP / sum Revenue across the quarter's
  // months), not an average of each month's own % — same principle as
  // the existing monthly blended GP% calc.
  const quarterlyGpData = useMemo(() => QUARTERS.map((idxs, qi) => {
    const budgetGp = idxs.reduce((s, i) => s + (monthlyGpData[i]?.Budget || 0), 0);
    const budgetRev = idxs.reduce((s, i) => s + (monthlyData[i]?.Budget || 0), 0);
    const actualGpVals = idxs.map(i => monthlyGpData[i]?.Actual);
    const actualRevVals = idxs.map(i => monthlyData[i]?.Actual);
    const hasActual = actualGpVals.some(v => v !== null && v !== undefined);
    const actualGp = hasActual ? actualGpVals.reduce((s, v) => s + (v || 0), 0) : null;
    const actualRev = hasActual ? actualRevVals.reduce((s, v) => s + (v || 0), 0) : null;
    const forecastGpVals = idxs.map(i => monthlyGpData[i]?.Forecast);
    const hasForecastGp = forecastGpVals.some(v => v !== null && v !== undefined);
    const forecastGp = hasForecastGp ? forecastGpVals.reduce((s, v) => s + (v || 0), 0) : null;
    return {
      month: `Q${qi + 1}`, Budget: Math.round(budgetGp), Actual: actualGp !== null ? Math.round(actualGp) : null, Forecast: forecastGp !== null ? Math.round(forecastGp) : null,
      "Budget GP%": budgetRev ? +(budgetGp / budgetRev * 100).toFixed(1) : 0,
      "Actual GP%": (actualRev !== null && actualRev) ? +(actualGp / actualRev * 100).toFixed(1) : null,
    };
  }), [monthlyData, monthlyGpData]);

  // Yearly compares distinct calendar years, not "remaining months of this
  // year" — a Forecast series doesn't mean the same thing there, so it's
  // intentionally omitted for this view (see the `viewMode !== "yearly"`
  // guard around the Forecast <Line> below).
  const yearlyRevenueData = useMemo(() => (yearlyRaw || []).map(d => ({
    month: d.year, Budget: Math.round(d.budgetRevenue), Actual: d.actualRevenue > 0 ? Math.round(d.actualRevenue) : null,
  })), [yearlyRaw]);
  const yearlyGpData = useMemo(() => (yearlyRaw || []).map(d => ({
    month: d.year, Budget: Math.round(d.budgetGp), Actual: d.actualGp > 0 ? Math.round(d.actualGp) : null,
    "Budget GP%": d.budgetRevenue ? +(d.budgetGp / d.budgetRevenue * 100).toFixed(1) : 0,
    "Actual GP%": d.actualRevenue > 0 ? +(d.actualGp / d.actualRevenue * 100).toFixed(1) : null,
  })), [yearlyRaw]);

  const chartData = viewMode === "monthly" ? monthlyData : viewMode === "quarterly" ? quarterlyData : yearlyRevenueData;
  const gpChartData = viewMode === "monthly" ? monthlyGpData : viewMode === "quarterly" ? quarterlyGpData : yearlyGpData;
  const periodLabel = { monthly: "Monthly", quarterly: "Quarterly", yearly: "By Year (last 5 years)" }[viewMode];
  const cutoffIdx = getActualCutoffMonthIndex(year);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={styles.kpiGrid}>
        <KpiCard
          label="YTD Revenue (Actual)" value={fmtN(kpis.totalActualYtd)}
          sub={`${fmtSignedN(kpis.varAmt, fmtN)} (${fmtSignedPct(kpis.varPct)})`} subLine2={`vs YTD Plan (${fmtN(kpis.totalYtdBudget)})`}
          trend={kpis.varAmt >= 0 ? "up" : "down"} icon={BarChart3} iconTier={revenueOutlook(kpis.varPct, "plan").tier}
        />
        <KpiCard
          label="FY Revenue Forecast" value={fmtN(kpis.totalFyForecastRev)}
          sub={`${fmtSignedN(kpis.forecastVarAmt, fmtN)} (${fmtSignedPct(kpis.forecastVarPct)})`} subLine2={`vs Budget (${fmtN(kpis.totalBudgetRev)})`}
          trend={kpis.forecastVarAmt >= 0 ? "up" : "down"} icon={TrendingUp} iconTier={revenueOutlook(kpis.forecastVarPct, "budget").tier}
          pill={revenueOutlook(kpis.forecastVarPct, "budget").text} pillTier={revenueOutlook(kpis.forecastVarPct, "budget").tier}
        />
        <KpiCard
          label="YTD Gross Profit (Actual)" value={fmtN(kpis.totalActualGpYtd)}
          sub={`${fmtSignedN(kpis.gpVarAmt, fmtN)} (${fmtSignedPct(kpis.gpVarPct)})`} subLine2={`vs YTD Plan (${fmtN(kpis.totalYtdBudgetGp)})`}
          trend={kpis.gpVarAmt >= 0 ? "up" : "down"} icon={PieChartIcon} iconTier={gpOutlook((kpis.actualGpPct - kpis.blendedGpPct) * 100, "budget margin").tier}
          pill={gpOutlook((kpis.actualGpPct - kpis.blendedGpPct) * 100, "budget margin").text} pillTier={gpOutlook((kpis.actualGpPct - kpis.blendedGpPct) * 100, "budget margin").tier}
        />
        <KpiCard
          label="FY GP Forecast" value={fmtN(kpis.totalFyForecastGp)}
          sub={`${fmtSignedN(kpis.gpForecastVarAmt, fmtN)} (${fmtSignedPct(kpis.gpForecastVarPct)})`} subLine2={`vs Budget (${fmtN(kpis.totalBudgetGp)})`}
          trend={kpis.gpForecastVarAmt >= 0 ? "up" : "down"} icon={PieChartIcon} iconTier={gpOutlook(kpis.gpForecastVarPts, "budget margin").tier}
          pill={gpOutlook(kpis.gpForecastVarPts, "budget margin").text} pillTier={gpOutlook(kpis.gpForecastVarPts, "budget margin").tier}
        />
      </div>

      <ManagementSnapshot kpis={kpis} marginDetractors={marginDetractors} fmtN={fmtN} onNavigate={onNavigate} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={styles.plViewToggle}>
          {[["monthly", "Monthly"], ["quarterly", "Quarterly"], ["yearly", "Yearly"]].map(([k, label]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{ ...styles.plToggleBtn, ...(viewMode === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <CollapsiblePanel title={`${periodLabel} Revenue — Actual vs Budget vs Forecast`}>
          {(height) => (viewMode === "yearly" && yearlyLoading) ? (
            <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>Loading last 5 years…</div>
          ) : (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" stroke="#6B6B6B" fontSize={12} />
                <YAxis stroke="#6B6B6B" fontSize={12} tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
                <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8, color: "#111111" }} cursor={{ stroke: "#B4231E", strokeDasharray: "3 3" }} />
                <Legend verticalAlign="bottom" />
                <Line type="monotone" dataKey="Budget" stroke="#6B6B6B" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="Actual" stroke="#C00000" strokeWidth={2.5} dot={actualEndpointDot(cutoffIdx, viewMode)} connectNulls={false} />
                {viewMode !== "yearly" && <Line type="monotone" dataKey="Forecast" stroke="#2E5FA3" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} />}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel title={`${periodLabel} Gross Profit — Actual vs Budget (with GP%)`}>
          {(height) => (
            <>
              {/* Header stat callout — YTD GP% vs budget GP%, with the pts
                  gap called out in red/green. Bar+line combo with GP% on
                  its own right-hand axis, matching the reference layout. */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 28, marginBottom: 8 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10.5, color: "#8A8A8A" }}>YTD GP%</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>{fmtPct(kpis.actualGpPct)}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 10.5, color: "#8A8A8A" }}>vs Budget GP%</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                    {fmtPct(kpis.blendedGpPct)}{" "}
                    <span style={{ fontSize: 12, fontWeight: 600, color: kpis.actualGpPct >= kpis.blendedGpPct ? "#1B8A3A" : "#C00000" }}>
                      {kpis.actualGpPct >= kpis.blendedGpPct ? "+" : ""}{((kpis.actualGpPct - kpis.blendedGpPct) * 100).toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>
              {(viewMode === "yearly" && yearlyLoading) ? (
                <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", fontSize: 13 }}>Loading last 5 years…</div>
              ) : (
                <ResponsiveContainer width="100%" height={height}>
                  <ComposedChart data={gpChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                    <XAxis dataKey="month" stroke="#6B6B6B" fontSize={12} />
                    <YAxis yAxisId="left" stroke="#6B6B6B" fontSize={12} tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B6B6B" fontSize={12} tickFormatter={(v) => `${v}%`} width={44} domain={[0, "dataMax"]} />
                    <Tooltip formatter={(v, name) => name === "GP% (Actual)" ? `${v}%` : fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8, color: "#111111" }} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Legend verticalAlign="bottom" />
                    <Bar yAxisId="left" dataKey="Actual" name="Actual GP ($)" fill="#B4231E" radius={[3, 3, 0, 0]} maxBarSize={40} />
                    <Line yAxisId="left" type="monotone" dataKey="Budget" name="Budget GP ($)" stroke="#9A9A9A" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="Actual GP%" name="GP% (Actual)" stroke="#B4231E" strokeWidth={2} dot={{ r: 4, fill: "#B4231E", strokeWidth: 0 }} connectNulls={false}>
                      <LabelList dataKey="Actual GP%" position="top" formatter={(v) => (v === null || v === undefined) ? "" : `${v}%`} style={{ fontSize: 10.5, fill: "#333333" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </CollapsiblePanel>
      </div>

      <div style={{ marginTop: 4 }}>
        <KeyDriversPanel movers={movers} marginDetractors={marginDetractors} regionMovers={regionMovers} regionLoading={regionLoading} fmtN={fmtN} onNavigate={onNavigate} />
      </div>

      <div style={{ ...styles.panel, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#6B6B6B" }}>Drill down into Vendors or Regions to see what's driving the variance.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onNavigate("vendors")} style={styles.secondaryBtn}>Go to Vendors</button>
          <button onClick={() => onNavigate("regions")} style={styles.secondaryBtn}>Go to Regions</button>
        </div>
      </div>
    </div>
  );
}

// Auto-generated (deterministic, not AI) headline + 2-3 supporting facts +
// clickable topic chips — revenue/GP topics only, no Cash Flow (that
// module is fully out of scope for this page). Chips double as navigation
// via onNavigate (App()'s setTab).
// Per-chip colors for "What needs attention" — a rotating identity palette
// (not a severity ramp like KPI_TIER_COLORS), matching the mockup.
// NOTE: Cash Flow is included here per an explicit mockup screenshot the
// user provided — this reverses the original redesign spec's "no cash
// flow chip" scope decision (Cash Flow is its own tab, deliberately kept
// out of Overview everywhere else on this page). Flagged to the user;
// remove this chip if that was unintentional.
const SNAPSHOT_CHIP_COLORS = {
  Margins: { fg: "#C0392B", bg: "#FBE3E1" },
  Vendors: { fg: "#9A6B12", bg: "#FFF3DC" },
  Regions: { fg: "#2E5FA3", bg: "#E3ECFB" },
  "Cash Flow": { fg: "#1B8A3A", bg: "#E8F5E9" },
};

function ManagementSnapshot({ kpis, marginDetractors, fmtN, onNavigate }) {
  const gpDiffPts = (kpis.actualGpPct - kpis.blendedGpPct) * 100;
  const revTier = revenueOutlook(kpis.varPct, "plan").tier;
  const gpTier = gpOutlook(gpDiffPts, "budget").tier;
  // Real driver data (marginDetractors, ranked by GP-pts-behind-budget —
  // see App()) rather than an invented example like "Services & 2 key
  // vendors" — names the actual vendor(s) responsible, or says plainly
  // that nothing stands out, per the app's "never invent" convention.
  const topDetractors = marginDetractors.slice(0, 2).map(v => v.vendor);
  const driverTier = topDetractors.length ? "bad" : "good";
  const driverText = topDetractors.length === 0
    ? "No single vendor is driving the margin gap — it's spread across the portfolio."
    : topDetractors.length === 1
      ? `Margin gap is mainly driven by ${topDetractors[0]}.`
      : `Margin gap is mainly driven by ${topDetractors[0]} & ${topDetractors[1]}.`;

  const facts = [
    {
      tier: revTier, Icon: kpis.varAmt >= 0 ? TrendingUp : TrendingDown,
      node: <>Revenue is <b>{fmtN(Math.abs(kpis.varAmt))}</b> {kpis.varAmt >= 0 ? "ahead of" : "behind"} YTD plan (<b style={{ color: KPI_TIER_COLORS[revTier].fg }}>{fmtSignedPct(kpis.varPct)}</b>).</>,
    },
    {
      tier: gpTier, Icon: gpDiffPts >= 0 ? TrendingUp : AlertTriangle,
      node: <>Realized GP% is <b>{fmtPct(kpis.actualGpPct)}</b> vs {fmtPct(kpis.blendedGpPct)} budget (<b style={{ color: KPI_TIER_COLORS[gpTier].fg }}>{gpDiffPts >= 0 ? "+" : ""}{gpDiffPts.toFixed(1)} pts</b>).</>,
    },
    { tier: driverTier, Icon: Target, node: driverText },
  ];
  const chips = [["Margins", "pl"], ["Vendors", "vendors"], ["Regions", "regions"], ["Cash Flow", "cashFlow"]];

  return (
    <div style={{ ...styles.panel, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#FBE3E1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lightbulb size={13} color="#C0392B" />
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#8A8A8A", letterSpacing: "0.04em" }}>MANAGEMENT SNAPSHOT</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Fraunces', serif", marginBottom: 14 }}>{buildSnapshotHeadline(kpis)}</div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 280, flexWrap: "wrap" }}>
          {facts.map((f, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ width: 1, height: 30, background: "#E0E0E0", flexShrink: 0 }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#333333", maxWidth: 260 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: KPI_TIER_COLORS[f.tier].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <f.Icon size={13} color={KPI_TIER_COLORS[f.tier].fg} />
                </div>
                <span>{f.node}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "#E0E0E0", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10.5, color: "#8A8A8A", marginBottom: 8 }}>What needs attention</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {chips.map(([label, tabId]) => (
              <button
                key={tabId} onClick={() => onNavigate(tabId)}
                style={{ border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: SNAPSHOT_CHIP_COLORS[label].fg, background: SNAPSHOT_CHIP_COLORS[label].bg }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Left column of the bottom section — three sub-columns of ranked
// highlights (the "highlight reel," not the full Vendors/Regions pages).
function KeyDriversPanel({ movers, marginDetractors, regionMovers, regionLoading, fmtN, onNavigate }) {
  const MiniBar = ({ value, max, color }) => (
    <div style={{ height: 4, borderRadius: 2, background: "#F0F0F0", marginTop: 4 }}>
      <div style={{ height: 4, borderRadius: 2, width: `${max ? Math.min(100, Math.abs(value) / max * 100) : 0}%`, background: color }} />
    </div>
  );
  const revenueContributors = [...movers].sort((a, b) => b.varAmt - a.varAmt).slice(0, 5);
  const maxContributorAbs = Math.max(1, ...revenueContributors.map(v => Math.abs(v.varAmt)));
  const maxDetractorPts = Math.max(1, ...marginDetractors.map(v => v.gpPtsBehind));
  const maxRegionAbs = Math.max(1, ...(regionMovers || []).map(r => Math.abs(r.varAmt)));

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Key Drivers — YTD vs Plan</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 8 }}>TOP REVENUE CONTRIBUTORS</div>
          {revenueContributors.length === 0 ? <div style={{ fontSize: 12, color: "#8A8A8A" }}>No data yet.</div> : revenueContributors.map(v => (
            <div key={v.vendor} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{v.vendor}</span>
                <span className="num" style={{ color: v.varAmt >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedN(v.varAmt, fmtN)} ({fmtSignedPct(v.ytd_budget_revenue ? v.varAmt / v.ytd_budget_revenue : 0)})</span>
              </div>
              <MiniBar value={v.varAmt} max={maxContributorAbs} color={v.varAmt >= 0 ? "#1B8A3A" : "#C00000"} />
            </div>
          ))}
          <button onClick={() => onNavigate("vendors")} style={{ ...styles.secondaryBtn, background: "transparent", border: "none", padding: "4px 0", fontSize: 11.5, color: "#B4231E" }}>View all →</button>
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 8 }}>TOP MARGIN DETRACTORS</div>
          {marginDetractors.length === 0 ? <div style={{ fontSize: 12, color: "#8A8A8A" }}>None — no vendor is trailing its budgeted GP%.</div> : marginDetractors.map(v => (
            <div key={v.vendor} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{v.vendor}</span>
                <span className="num" style={{ color: "#7A3F9A" }}>-{v.gpPtsBehind.toFixed(1)} pts</span>
              </div>
              <MiniBar value={v.gpPtsBehind} max={maxDetractorPts} color="#7A3F9A" />
            </div>
          ))}
          <button onClick={() => onNavigate("vendors")} style={{ ...styles.secondaryBtn, background: "transparent", border: "none", padding: "4px 0", fontSize: 11.5, color: "#B4231E" }}>View all →</button>
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 8 }}>TOP REGIONS</div>
          {regionLoading ? <div style={{ fontSize: 12, color: "#8A8A8A" }}>Loading…</div> : (regionMovers || []).length === 0 ? <div style={{ fontSize: 12, color: "#8A8A8A" }}>No data yet.</div> : regionMovers.map(r => (
            <div key={r.name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{r.name}</span>
                <span className="num" style={{ color: r.varAmt >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedN(r.varAmt, fmtN)} ({fmtSignedPct(r.ytd_budget_revenue ? r.varAmt / r.ytd_budget_revenue : 0)})</span>
              </div>
              <MiniBar value={r.varAmt} max={maxRegionAbs} color={r.varAmt >= 0 ? "#1B8A3A" : "#C00000"} />
            </div>
          ))}
          <button onClick={() => onNavigate("regions")} style={{ ...styles.secondaryBtn, background: "transparent", border: "none", padding: "4px 0", fontSize: 11.5, color: "#B4231E" }}>View all →</button>
        </div>
      </div>
    </div>
  );
}

function VendorsTab({ rows, search, setSearch, sortKey, sortDir, toggleSort, editingVendor, editValue, setEditValue, startEdit, commitEdit, setEditingVendor, onPlan, isEditableYear, activeBudgetingYear, onAddVendorClick, onRemoveVendor }) {
  const { fmtN } = useNumberUnit();
  const Th = ({ k, label, align }) => (
    <th onClick={() => toggleSort(k)} style={{ ...styles.th, textAlign: align || "right", cursor: "pointer" }}>
      {label} {sortKey === k && <ChevronDown size={12} style={{ transform: sortDir === "asc" ? "rotate(180deg)" : "none", verticalAlign: -1 }} />}
    </th>
  );
  const totals = useMemo(() => {
    const t = { budget_revenue: 0, budget_gp: 0 };
    for (const v of rows) { t.budget_revenue += v.budget_revenue; t.budget_gp += v.budget_gp; }
    return { ...t, budget_gp_pct: t.budget_revenue ? t.budget_gp / t.budget_revenue : 0 };
  }, [rows]);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={styles.tableToolbar}>
        <div style={styles.searchBox}><Search size={14} color="#6B6B6B" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" style={styles.searchInput} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.tableHint}>
            {isEditableYear
              ? 'Click a figure to edit inline · "Plan FY" builds a full month × country split'
              : `Read-only — editing is only enabled for ${activeBudgetingYear}`}
          </div>
          {isEditableYear && (
            <button onClick={onAddVendorClick} style={styles.planBtn}>+ Add Vendor</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 10 }}>
        This is the active budgeting year — there's no actuals or variance to show yet. Once {activeBudgetingYear} is underway, switch to it from the Year dropdown to see performance tracking against this budget.
      </div>
      <div style={styles.panel}>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>Vendor</th>
                <Th k="budget_revenue" label="Budget Revenue" />
                <Th k="budget_gp" label="Budget GP" />
                <Th k="gp_pct" label="GP%" />
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(v => (
                <tr key={v.vendor} className="row-hover" style={styles.tr}>
                  <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>
                    {v.vendor}{v.country_grid && <span title="Has a planned month × country split" style={styles.plannedDot} />}
                  </td>
                  <td className="num" style={styles.td}>
                    {isEditableYear && editingVendor === v.vendor ? (
                      <input autoFocus className="num" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(v.vendor); if (e.key === "Escape") setEditingVendor(null); }}
                        onBlur={() => commitEdit(v.vendor)} style={styles.inlineInput} />
                    ) : isEditableYear ? (
                      <span onClick={() => startEdit(v)} style={styles.editableCell}>{fmtN(v.budget_revenue)}</span>
                    ) : (
                      <span>{fmtN(v.budget_revenue)}</span>
                    )}
                  </td>
                  <td className="num" style={styles.td}>{fmtN(v.budget_gp)}</td>
                  <td className="num" style={styles.td}>{fmtPct(v.gp_pct)}</td>
                  <td style={{ ...styles.td, textAlign: "center", whiteSpace: "nowrap" }}>
                    {isEditableYear ? (
                      <>
                        <button onClick={() => onPlan(v)} style={styles.planBtn}><Sliders size={12} style={{ marginRight: 5 }} />Plan FY</button>
                        <button onClick={() => onRemoveVendor(v.vendor)} style={{ ...styles.iconBtnGhost, marginLeft: 6 }} title={`Remove ${v.vendor} from ${activeBudgetingYear}`}><X size={13} /></button>
                      </>
                    ) : (
                      <button disabled style={{ ...styles.planBtn, opacity: 0.4, cursor: "not-allowed" }} title={`Read-only — editing enabled for ${activeBudgetingYear} only`}><Sliders size={12} style={{ marginRight: 5 }} />Plan FY</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111111" }}>
                <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget_revenue)}</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget_gp)}</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtPct(totals.budget_gp_pct)}</td>
                <td style={styles.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddVendorModal({ onCancel, onAdd, year }) {
  const [name, setName] = useState("");
  const [startMonth, setStartMonth] = useState(1);
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Add Vendor for {year}</div>
          <button onClick={onCancel} style={styles.iconBtnGhost} title="Close"><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#6B6B6B", marginBottom: 14 }}>Only affects the active budgeting year.</div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", display: "block", marginBottom: 4 }}>Vendor name<RequiredStar /></label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wiz" style={styles.modalInput} />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", display: "block", margin: "12px 0 4px" }}>Budget start month</label>
        <select value={startMonth} onChange={(e) => setStartMonth(parseInt(e.target.value, 10))} style={styles.modalInput}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}{i === 0 ? " (full year)" : ""}</option>)}
        </select>
        <div style={{ fontSize: 11.5, color: "#6B6B6B", marginTop: 8 }}>
          Not every vendor starts from January — this greys out earlier months in the Plan FY grid so budget is only entered from the actual start month onward.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
          <button onClick={() => name.trim() && onAdd(name.trim(), startMonth)} style={styles.primaryBtn} disabled={!name.trim()}>Add Vendor</button>
        </div>
      </div>
    </div>
  );
}

function RegionsTab({ regions }) {
  const { fmtN } = useNumberUnit();
  const totals = regions.reduce((t, r) => ({
    budget_revenue: t.budget_revenue + r.budget_revenue, budget_gp: t.budget_gp + r.budget_gp,
  }), { budget_revenue: 0, budget_gp: 0 });

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 10 }}>
        Rolled up from each vendor's planned month × country grid where set; unplanned vendors are attributed using the company-wide historical split. This is the active budgeting year — there's no actuals or variance to show yet.
      </div>
      <div style={styles.panel}>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>Country / Region</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Budget Revenue</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Budget GP</th>
                <th style={{ ...styles.th, textAlign: "right" }}>GP%</th>
              </tr>
            </thead>
            <tbody>
              {regions.map(r => {
                const budgetGpPct = r.budget_revenue ? r.budget_gp / r.budget_revenue : 0;
                return (
                  <tr key={r.region} className="row-hover" style={styles.tr}>
                    <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>{r.region}</td>
                    <td className="num" style={styles.td}>{fmtN(r.budget_revenue)}</td>
                    <td className="num" style={styles.td}>{fmtN(r.budget_gp)}</td>
                    <td className="num" style={styles.td}>{fmtPct(budgetGpPct)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111111" }}>
                <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget_revenue)}</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget_gp)}</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtPct(totals.budget_revenue ? totals.budget_gp / totals.budget_revenue : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function PLTab({ alloc }) {
  const { fmtN } = useNumberUnit();
  const [view, setView] = useState("monthly"); // monthly | vendor | country
  const companyGpPct = alloc.totalGP ? alloc.totalGP / alloc.monthlyPL.reduce((s, m) => s + m.revenue, 0) : 0;
  const totalRevenue = alloc.monthlyPL.reduce((s, m) => s + m.revenue, 0);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={styles.kpiGrid}>
        <KpiCard label="FY Budget GP" value={fmtN(alloc.totalGP)} />
        <KpiCard label="Total SGA Allocated" value={fmtN(alloc.totalSGA)} sub={`${fmtN(alloc.empAnnual)} employee · ${fmtN(alloc.nonEmpAnnual)} non-employee`} />
        <KpiCard label="FY Budget EBID" value={fmtN(alloc.totalEbid)} sub={`${fmtPct(totalRevenue ? alloc.totalEbid / totalRevenue : 0)} of revenue`} trend={alloc.totalEbid >= 0 ? "up" : "down"} />
        <KpiCard label="Blended GP% → EBID%" value={fmtPct(companyGpPct)} sub={`down to ${fmtPct(totalRevenue ? alloc.totalEbid / totalRevenue : 0)} EBID%`} />
      </div>

      <div style={styles.plViewToggle}>
        {[["monthly", "Monthly (Company)"], ["vendor", "Vendor-wise"], ["country", "Country-wise"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{ ...styles.plToggleBtn, ...(view === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
        ))}
      </div>

      {view === "monthly" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Monthly P&amp;L — Revenue → GP → SGA → EBID</div>
          <div style={{ fontSize: 11, color: "#8A8A8A", marginBottom: 10 }}>GP% held constant per vendor across months (monthly GP isn't tracked as its own grid — derived from each vendor's annual GP% × monthly revenue). Depreciation and interest sit below EBID at the company level, not shown here.</div>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead><tr><th style={{ ...styles.th, textAlign: "left" }}>Month</th><th style={styles.th}>Revenue</th><th style={styles.th}>GP</th><th style={styles.th}>GP%</th><th style={styles.th}>SGA</th><th style={styles.th}>EBID</th><th style={styles.th}>EBID%</th></tr></thead>
              <tbody>
                {alloc.monthlyPL.map(m => (
                  <tr key={m.month} className="row-hover" style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 600 }}>{m.month}</td>
                    <td className="num" style={styles.td}>{fmtN(m.revenue)}</td>
                    <td className="num" style={styles.td}>{fmtN(m.gp)}</td>
                    <td className="num" style={styles.td}>{fmtPct(m.revenue ? m.gp / m.revenue : 0)}</td>
                    <td className="num" style={styles.td}>{fmtN(m.sga)}</td>
                    <td className="num" style={{ ...styles.td, color: m.ebid >= 0 ? "#1B8A3A" : "#C00000", fontWeight: 600 }}>{fmtN(m.ebid)}</td>
                    <td className="num" style={{ ...styles.td, color: m.ebid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(m.revenue ? m.ebid / m.revenue : 0)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #E0E0E0" }}>
                  <td style={{ ...styles.td, textAlign: "left", fontWeight: 700 }}>FY Total</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.monthlyPL.reduce((s, m) => s + m.revenue, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.totalGP)}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtPct(companyGpPct)}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.totalSGA)}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtN(alloc.totalEbid)}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(totalRevenue ? alloc.totalEbid / totalRevenue : 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "vendor" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Vendor-wise EBID</div>
          <div style={{ fontSize: 11, color: "#8A8A8A", marginBottom: 10 }}>SGA = non-employee costs allocated by GP share + employee cost allocated within each employee's assigned vendor list (spec §7).</div>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead><tr><th style={{ ...styles.th, textAlign: "left" }}>Vendor</th><th style={styles.th}>Budget Rev</th><th style={styles.th}>Budget GP</th><th style={styles.th}>SGA Allocated</th><th style={styles.th}>EBID</th><th style={styles.th}>EBID%</th></tr></thead>
              <tbody>
                {alloc.vendorPL.map(v => (
                  <tr key={v.vendor} className="row-hover" style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 600 }}>{v.vendor}</td>
                    <td className="num" style={styles.td}>{fmtN(v.revenue)}</td>
                    <td className="num" style={styles.td}>{fmtN(v.gp)}</td>
                    <td className="num" style={styles.td}>{fmtN(v.sga)}</td>
                    <td className="num" style={{ ...styles.td, color: v.ebid >= 0 ? "#1B8A3A" : "#C00000", fontWeight: 600 }}>{fmtN(v.ebid)}</td>
                    <td className="num" style={{ ...styles.td, color: v.ebid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(v.revenue ? v.ebid / v.revenue : 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #111111" }}>
                  <td style={{ ...styles.td, textAlign: "left", fontWeight: 700 }}>Total</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.vendorPL.reduce((s, v) => s + v.revenue, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.vendorPL.reduce((s, v) => s + v.gp, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.vendorPL.reduce((s, v) => s + v.sga, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtN(alloc.vendorPL.reduce((s, v) => s + v.ebid, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(totalRevenue ? alloc.vendorPL.reduce((s, v) => s + v.ebid, 0) / totalRevenue : 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {view === "country" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Country-wise EBID</div>
          <div style={{ fontSize: 11, color: "#8A8A8A", marginBottom: 10 }}>SGA = non-employee costs allocated by GP share + employee cost allocated within each employee's assigned country list (spec §7) — independent of the vendor-wise allocation above.</div>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead><tr><th style={{ ...styles.th, textAlign: "left" }}>Country</th><th style={styles.th}>Budget Rev</th><th style={styles.th}>Budget GP</th><th style={styles.th}>SGA Allocated</th><th style={styles.th}>EBID</th><th style={styles.th}>EBID%</th></tr></thead>
              <tbody>
                {alloc.countryPL.map(r => (
                  <tr key={r.region} className="row-hover" style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 600 }}>{r.region}</td>
                    <td className="num" style={styles.td}>{fmtN(r.revenue)}</td>
                    <td className="num" style={styles.td}>{fmtN(r.gp)}</td>
                    <td className="num" style={styles.td}>{fmtN(r.sga)}</td>
                    <td className="num" style={{ ...styles.td, color: r.ebid >= 0 ? "#1B8A3A" : "#C00000", fontWeight: 600 }}>{fmtN(r.ebid)}</td>
                    <td className="num" style={{ ...styles.td, color: r.ebid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(r.revenue ? r.ebid / r.revenue : 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #111111" }}>
                  <td style={{ ...styles.td, textAlign: "left", fontWeight: 700 }}>Total</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.countryPL.reduce((s, r) => s + r.revenue, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.countryPL.reduce((s, r) => s + r.gp, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(alloc.countryPL.reduce((s, r) => s + r.sga, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtN(alloc.countryPL.reduce((s, r) => s + r.ebid, 0))}</td>
                  <td className="num" style={{ ...styles.td, fontWeight: 700, color: alloc.totalEbid >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtPct(totalRevenue ? alloc.countryPL.reduce((s, r) => s + r.ebid, 0) / totalRevenue : 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Other Expenses Budgeting Module — Phase 1 (sync + mapping) -----------
// Growth assumptions, agreement registers, the trend/agreement budget
// engine, and the actual-vs-budget dashboard are NOT built yet — this tab
// currently only covers getting ledger data in and mapped to categories,
// per the spec's own stated build order (mapping first, since nothing else
// can calculate meaningfully until accounts are categorized).
function OtherExpensesTab({ showToast, year, isEditableYear, activeBudgetingYear }) {
  const { fmtN } = useNumberUnit();
  const [view, setView] = useState("dashboard"); // dashboard | agreements | growth | budget
  const [rollup, setRollup] = useState([]);
  const [categories, setCategories] = useState([]);
  const [unmapped, setUnmapped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [growthMap, setGrowthMap] = useState({});
  const [budgetLines, setBudgetLines] = useState([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rollupRows, cats, unmappedRows, agreementRows, growth, budget] = await Promise.all([
        getCategoryRollup(year), getExpenseCategories(), getUnmappedAccounts(),
        getExpenseAgreements(), getGrowthAssumptions(year), getOtherExpensesBudget(year),
      ]);
      setRollup(rollupRows);
      setCategories(cats);
      setUnmapped(unmappedRows);
      setAgreements(agreementRows);
      setGrowthMap(growth);
      setBudgetLines(budget);
    } catch (e) {
      console.error("OtherExpensesTab load failed:", e);
      showToast(`Couldn't load Other Expenses data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [year]);

  const topLevelCategories = categories.filter(c => !c.parentCategoryId);
  const subcategoriesOf = (parentId) => categories.filter(c => c.parentCategoryId === parentId);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncOtherExpensesLedgerNow();
      await load();
      showToast(`Synced ${result.ledgerRecordsUpdated} ledger records — ${result.autoMappedFromGrouping} new + ${result.backfilledFromGrouping} existing accounts auto-mapped from Grouping.`);
    } catch (e) {
      showToast(`Ledger sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addExpenseCategory(newCategoryName, newCategoryParent || null);
      setNewCategoryName(""); setNewCategoryParent("");
      await load();
    } catch (e) {
      showToast(`Couldn't add category: ${e.message}`);
    }
  };

  const handleRemoveCategory = async (id, name) => {
    if (!window.confirm(`Remove category "${name}"? This won't un-map accounts already assigned to it.`)) return;
    try {
      await removeExpenseCategory(id);
      await load();
    } catch (e) {
      showToast(`Couldn't remove category: ${e.message}`);
    }
  };

  const handleMap = async (accountId, categoryId, subcategoryId) => {
    try {
      await setGlAccountMapping(accountId, categoryId, subcategoryId, auth.currentUser?.email || "unknown");
      setUnmapped(prev => prev.filter(a => a.id !== accountId)); // optimistic — leaves the queue immediately
      await load(); // refresh the rollup too, since this account now contributes to a category total
    } catch (e) {
      showToast(`Couldn't save mapping: ${e.message}`);
    }
  };

  const handleRemap = async (accountId, categoryId, subcategoryId) => {
    try {
      await setGlAccountMapping(accountId, categoryId, subcategoryId, auth.currentUser?.email || "unknown");
      await load();
      showToast("Re-mapped");
    } catch (e) {
      showToast(`Couldn't re-map: ${e.message}`);
    }
  };

  const grandTotal = rollup.reduce((s, c) => s + c.total, 0);

  const handleSetGrowth = async (categoryId, pct) => {
    try {
      await setGrowthAssumption(year, categoryId, pct);
      setGrowthMap(prev => ({ ...prev, [categoryId]: pct }));
    } catch (e) {
      showToast(`Couldn't save growth assumption: ${e.message}`);
    }
  };

  const handleGenerate = async () => {
    if (!isEditableYear) { showToast(`Budget generation is only available for ${activeBudgetingYear}.`); return; }
    if (!window.confirm(`Generate the ${year} Other Expenses budget from last year's actuals + growth% + agreements? This overwrites any existing generated lines (manual overrides on categories you haven't touched are preserved as their own separate edit — this just recalculates the base).`)) return;
    setGenerating(true);
    try {
      const result = await generateOtherExpensesBudget(year);
      await load();
      showToast(`Generated ${result.linesGenerated} budget lines — ${result.agreementDriven} from agreements, ${result.trendDriven} from trend, ${result.skipped} skipped (no data).`);
    } catch (e) {
      showToast(`Budget generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleOverrideBudget = async (lineId, monthIndex, amount) => {
    if (!isEditableYear) { showToast(`Editing is only enabled for ${activeBudgetingYear}.`); return; }
    try {
      await overrideOtherExpensesBudgetLine(year, lineId, monthIndex, amount, auth.currentUser?.email || "unknown");
      await load();
    } catch (e) {
      showToast(`Couldn't save override: ${e.message}`);
    }
  };

  const handleSaveAgreement = async (fields, existingId) => {
    try {
      if (existingId) await updateExpenseAgreement(existingId, fields);
      else await addExpenseAgreement(fields);
      await load();
      showToast(existingId ? "Agreement updated" : "Agreement added");
    } catch (e) {
      showToast(`Couldn't save agreement: ${e.message}`);
    }
  };

  const handleRemoveAgreement = async (id, name) => {
    if (!window.confirm(`Remove agreement "${name}"?`)) return;
    try {
      await removeExpenseAgreement(id);
      await load();
    } catch (e) {
      showToast(`Couldn't remove agreement: ${e.message}`);
    }
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={styles.plViewToggle}>
        {[["dashboard", "Dashboard"], ["agreements", "Agreements"], ["growth", "Growth Assumptions"], ["budget", `Budget & Variance (${year})`]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{ ...styles.plToggleBtn, ...(view === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
        ))}
      </div>

      {view === "dashboard" && (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: "#8A8A8A" }}>
          Actuals by category for {year}, from the synced GL ledger. Categories are auto-created from Zoho's "Grouping" field, and accounts with a Grouping value are auto-mapped — only accounts with no Grouping need manual mapping below.
        </div>
        <button onClick={handleSync} disabled={syncing} style={styles.planBtn}>
          <RefreshCw size={12} style={{ marginRight: 5, ...(syncing ? { animation: "spin 1s linear infinite" } : {}) }} />
          {syncing ? "Syncing…" : "Sync Ledger"}
        </button>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Categories — {year} Actuals by Month</div>
        {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : rollup.length === 0 || grandTotal === 0 ? (
          <div style={{ fontSize: 12, color: "#6B6B6B" }}>
            No mapped actuals for {year} yet. {topLevelCategories.length === 0 ? 'Click "Sync Ledger" above to pull data and auto-create categories from Grouping.' : "Map the accounts below to see them roll up here."}
          </div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Category</th>
                  {MONTHS.map(m => <th key={m} style={styles.th}>{m}</th>)}
                  <th style={{ ...styles.th, fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rollup.map(cat => (
                  <CategoryRollupRow
                    key={cat.id} category={cat} depth={0} expandedId={expandedId} setExpandedId={setExpandedId}
                    topLevelCategories={topLevelCategories} subcategoriesOf={subcategoriesOf} onRemap={handleRemap} fmtN={fmtN}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #111111" }}>
                  <td style={{ ...styles.td, textAlign: "left", fontWeight: 700 }}>Total</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="num" style={{ ...styles.td, fontWeight: 700 }}>
                      {fmtN(rollup.reduce((s, c) => s + (c.monthly[i] || 0), 0))}
                    </td>
                  ))}
                  <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Categories</div>
        <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 10 }}>Auto-created from Grouping during sync — add more manually if needed (e.g. to split a broad Grouping into finer subcategories).</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category or subcategory name" style={{ ...styles.chatInput, background: "#FFFFFF", maxWidth: 260 }} />
          <select value={newCategoryParent} onChange={(e) => setNewCategoryParent(e.target.value)} style={styles.yearSelect}>
            <option value="">— Top-level category —</option>
            {topLevelCategories.map(c => <option key={c.id} value={c.id}>Subcategory of: {c.name}</option>)}
          </select>
          <button onClick={handleAddCategory} style={styles.primaryBtn} disabled={!newCategoryName.trim()}>Add</button>
        </div>
        {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : topLevelCategories.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6B6B6B" }}>No categories yet — click "Sync Ledger" above, or add one manually.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topLevelCategories.map(cat => (
              <div key={cat.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{cat.name}</span>
                  <button onClick={() => handleRemoveCategory(cat.id, cat.name)} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }} title={`Remove ${cat.name}`}><X size={11} /></button>
                </div>
                {subcategoriesOf(cat.id).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, marginLeft: 16 }}>
                    {subcategoriesOf(cat.id).map(sub => (
                      <span key={sub.id} style={{ fontSize: 11.5, color: "#6B6B6B", background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 6, padding: "2px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                        {sub.name}
                        <X size={10} style={{ cursor: "pointer" }} onClick={() => handleRemoveCategory(sub.id, sub.name)} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Unmapped GL Accounts {unmapped.length > 0 && `(${unmapped.length})`}</div>
        <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 10 }}>Accounts with no Grouping value in Zoho — these need a category assigned manually.</div>
        {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : unmapped.length === 0 ? (
          <div style={{ fontSize: 12, color: "#1B8A3A" }}>✓ Every synced GL account is mapped to a category.</div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Entity</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>GL Code</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Account Name</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Type</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Category</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {unmapped.map(a => (
                  <MappingRow key={a.id} account={a} topLevelCategories={topLevelCategories} subcategoriesOf={subcategoriesOf} onMap={handleMap} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {view === "agreements" && (
        <AgreementsView
          agreements={agreements} categories={categories} topLevelCategories={topLevelCategories} subcategoriesOf={subcategoriesOf}
          onSave={handleSaveAgreement} onRemove={handleRemoveAgreement} fmtN={fmtN}
        />
      )}

      {view === "growth" && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Growth Assumptions — {year}</div>
          <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 14 }}>
            One growth% per category, applied uniformly across all entities. Used by the trend-driven budget calculation (last year's actual × growth%) for any category without an active agreement. Not restricted to the active budgeting year — set assumptions ahead of time if useful.
          </div>
          {topLevelCategories.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6B6B6B" }}>No categories yet — sync the ledger first.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...topLevelCategories, ...categories.filter(c => c.parentCategoryId)].map(cat => (
                <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 260, fontSize: 13, fontWeight: cat.parentCategoryId ? 400 : 600, paddingLeft: cat.parentCategoryId ? 16 : 0, color: cat.parentCategoryId ? "#6B6B6B" : "#111111" }}>{cat.name}</span>
                  <input type="number" defaultValue={growthMap[cat.id] || 0} onBlur={(e) => handleSetGrowth(cat.id, parseFloat(e.target.value) || 0)} style={{ ...styles.gridCellInput, position: "static", width: 70 }} />
                  <span style={{ fontSize: 12, color: "#6B6B6B" }}>%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "budget" && (
        <BudgetVarianceView
          year={year} isEditableYear={isEditableYear} activeBudgetingYear={activeBudgetingYear}
          budgetLines={budgetLines} rollup={rollup} categories={categories}
          generating={generating} onGenerate={handleGenerate} onOverride={handleOverrideBudget} fmtN={fmtN}
        />
      )}
    </div>
  );
}

// One row per category (and, when expanded, one sub-row per subcategory and
// per contributing GL account) — the "click legal cost, see it expand into
// what rolls up to that number, with an option to re-map" behavior.
function CategoryRollupRow({ category, depth, expandedId, setExpandedId, topLevelCategories, subcategoriesOf, onRemap, fmtN }) {
  const isExpanded = expandedId === category.id;
  const hasChildren = (category.subcategories && category.subcategories.length > 0) || (category.accounts && category.accounts.length > 0);
  return (
    <>
      <tr className="row-hover" style={{ ...styles.tr, cursor: hasChildren ? "pointer" : "default" }} onClick={() => hasChildren && setExpandedId(isExpanded ? null : category.id)}>
        <td style={{ ...styles.td, textAlign: "left", fontWeight: depth === 0 ? 600 : 500, paddingLeft: 16 + depth * 18 }}>
          {hasChildren && (isExpanded ? <ChevronDown size={12} style={{ marginRight: 5, verticalAlign: -1 }} /> : <ChevronRight size={12} style={{ marginRight: 5, verticalAlign: -1 }} />)}
          {category.name}
        </td>
        {category.monthly.map((v, i) => <td key={i} className="num" style={styles.td}>{v ? fmtN(v) : "—"}</td>)}
        <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(category.total)}</td>
      </tr>
      {isExpanded && (
        <>
          {(category.subcategories || []).map(sub => (
            <CategoryRollupRow key={sub.id} category={sub} depth={depth + 1} expandedId={expandedId} setExpandedId={setExpandedId} topLevelCategories={topLevelCategories} subcategoriesOf={subcategoriesOf} onRemap={onRemap} fmtN={fmtN} />
          ))}
          {(category.accounts || []).filter(a => a.categoryId === category.id).map(acc => (
            <tr key={acc.id} style={{ background: "#FAFAF9" }}>
              <td style={{ ...styles.td, textAlign: "left", fontSize: 11.5, color: "#6B6B6B", paddingLeft: 16 + (depth + 1) * 18 }}>
                {acc.entity} · {acc.glCode} · {acc.glName}
              </td>
              <td colSpan={12} style={{ ...styles.td, fontSize: 11, color: "#8A8A8A" }}></td>
              <td className="num" style={{ ...styles.td, fontSize: 11.5 }}>
                {fmtN(acc.monthlyTotal)}
                <RemapControl account={acc} topLevelCategories={topLevelCategories} subcategoriesOf={subcategoriesOf} onRemap={onRemap} />
              </td>
            </tr>
          ))}
        </>
      )}
    </>
  );
}

function RemapControl({ account, topLevelCategories, subcategoriesOf, onRemap }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(account.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(account.subcategoryId || "");
  const subs = categoryId ? subcategoriesOf(categoryId) : [];
  if (!open) return <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} style={{ ...styles.iconBtnGhost, width: 20, height: 20, marginLeft: 6 }} title="Re-map this account"><Sliders size={10} /></button>;
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
      <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }} style={{ ...styles.yearSelect, fontSize: 10.5, padding: "2px 6px" }}>
        {topLevelCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {subs.length > 0 && (
        <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} style={{ ...styles.yearSelect, fontSize: 10.5, padding: "2px 6px" }}>
          <option value="">(none)</option>
          {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button onClick={() => { onRemap(account.id, categoryId, subcategoryId); setOpen(false); }} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }} title="Save"><Check size={10} /></button>
    </span>
  );
}

function MappingRow({ account, topLevelCategories, subcategoriesOf, onMap }) {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const subs = categoryId ? subcategoriesOf(categoryId) : [];
  return (
    <tr className="row-hover" style={styles.tr}>
      <td style={{ ...styles.td, textAlign: "left" }}>{account.entity}</td>
      <td style={{ ...styles.td, textAlign: "left" }}>{account.glCode}</td>
      <td style={{ ...styles.td, textAlign: "left" }}>{account.glName}</td>
      <td style={{ ...styles.td, textAlign: "left", fontSize: 11, color: "#6B6B6B" }}>{account.accountType}</td>
      <td style={{ ...styles.td, textAlign: "left" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }} style={{ ...styles.yearSelect, fontSize: 11.5, padding: "4px 8px" }}>
            <option value="">Choose category…</option>
            {topLevelCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {subs.length > 0 && (
            <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} style={{ ...styles.yearSelect, fontSize: 11.5, padding: "4px 8px" }}>
              <option value="">(no subcategory)</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </td>
      <td style={{ ...styles.td, textAlign: "center" }}>
        <button onClick={() => onMap(account.id, categoryId, subcategoryId)} disabled={!categoryId} style={{ ...styles.planBtn, opacity: categoryId ? 1 : 0.4, cursor: categoryId ? "pointer" : "not-allowed" }}>Map</button>
      </td>
    </tr>
  );
}

// ---- Agreements (rent / consultant / subscription, unified) ---------------
function AgreementsView({ agreements, categories, topLevelCategories, subcategoriesOf, onSave, onRemove, fmtN }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // agreement object being edited, or null for "new"
  const categoryName = (id) => categories.find(c => c.id === id)?.name || "(uncategorized)";

  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={styles.panelTitle}>Rent / Consultant / Subscription Agreements</div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} style={styles.primaryBtn}>+ Add Agreement</button>
      </div>
      <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 14 }}>
        An active agreement takes precedence over the trend calculation for its category — its terms drive the budget number directly.
      </div>

      {formOpen && (
        <AgreementForm
          topLevelCategories={topLevelCategories}
          initial={editing}
          onCancel={() => setFormOpen(false)}
          onSave={(fields) => { onSave(fields, editing?.id); setFormOpen(false); }}
        />
      )}

      {agreements.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6B6B6B" }}>No agreements yet.</div>
      ) : (
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: "left" }}>Type</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Name</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Entity</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Category</th>
                <th style={styles.th}>Amount</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Active</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {agreements.map(a => (
                <tr key={a.id} className="row-hover" style={styles.tr}>
                  <td style={{ ...styles.td, textAlign: "left", textTransform: "capitalize" }}>{a.type}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>{a.name}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>{a.entity || "\u2014"}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>{categoryName(a.categoryId)}</td>
                  <td className="num" style={styles.td}>{fmtN(a.monthlyRent || a.monthlyAmount || a.fee || 0)}{a.type === "consultant" ? ` /${a.frequency?.replace("_", "-")}` : " /mo"}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>{a.activeFlag ? <span style={{ color: "#1B8A3A" }}>Active</span> : <span style={{ color: "#8A8A8A" }}>Inactive</span>}</td>
                  <td style={{ ...styles.td, textAlign: "center", whiteSpace: "nowrap" }}>
                    <button onClick={() => { setEditing(a); setFormOpen(true); }} style={{ ...styles.iconBtnGhost, width: 22, height: 22 }} title="Edit"><Sliders size={11} /></button>
                    <button onClick={() => onRemove(a.id, a.name)} style={{ ...styles.iconBtnGhost, width: 22, height: 22, marginLeft: 4 }} title="Remove"><X size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgreementForm({ topLevelCategories, initial, onCancel, onSave }) {
  const [type, setType] = useState(initial?.type || "rent");
  const [name, setName] = useState(initial?.name || "");
  const [entity, setEntity] = useState(initial?.entity || "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "");
  const [activeFlag, setActiveFlag] = useState(initial?.activeFlag ?? true);
  const [monthlyRent, setMonthlyRent] = useState(initial?.monthlyRent || "");
  const [escalationPct, setEscalationPct] = useState(initial?.escalationPct || "");
  const [leaseStart, setLeaseStart] = useState(initial?.leaseStart || "");
  const [leaseEnd, setLeaseEnd] = useState(initial?.leaseEnd || "");
  const [fee, setFee] = useState(initial?.fee || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "monthly");
  const [oneTimeMonth, setOneTimeMonth] = useState(initial?.oneTimeMonth || 12);
  const [contractStart, setContractStart] = useState(initial?.contractStart || "");
  const [contractEnd, setContractEnd] = useState(initial?.contractEnd || "");
  const [monthlyAmount, setMonthlyAmount] = useState(initial?.monthlyAmount || "");
  const [billingCycle, setBillingCycle] = useState(initial?.billingCycle || "monthly");
  const [renewalDate, setRenewalDate] = useState(initial?.renewalDate || "");

  const handleSave = () => {
    if (!name.trim() || !categoryId) return;
    const base = { type, name: name.trim(), entity: entity.trim() || null, categoryId, activeFlag };
    const fields = type === "rent" ? { ...base, monthlyRent: parseFloat(monthlyRent) || 0, escalationPct: parseFloat(escalationPct) || 0, leaseStart: leaseStart || null, leaseEnd: leaseEnd || null }
      : type === "consultant" ? { ...base, fee: parseFloat(fee) || 0, frequency, oneTimeMonth: frequency === "one_time" ? oneTimeMonth : null, contractStart: contractStart || null, contractEnd: contractEnd || null }
      : { ...base, monthlyAmount: parseFloat(monthlyAmount) || 0, billingCycle, renewalDate: renewalDate || null };
    onSave(fields);
  };

  return (
    <div style={{ background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Type</div>
          <select value={type} onChange={(e) => setType(e.target.value)} style={styles.yearSelect}>
            <option value="rent">Rent</option>
            <option value="consultant">Consultant</option>
            <option value="subscription">Subscription</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>{type === "rent" ? "Office name" : type === "consultant" ? "Consultant name" : "Subscription vendor"}<RequiredStar /></div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "rent" ? "e.g. Riyadh HQ" : type === "consultant" ? "e.g. Jane Doe" : "e.g. Salesforce"} style={{ ...styles.chatInput, background: "#FFFFFF", maxWidth: 220 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Entity</div>
          <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="e.g. CBK" style={{ ...styles.chatInput, background: "#FFFFFF", maxWidth: 120 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Category<RequiredStar /></div>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={styles.yearSelect}>
            <option value="">Choose category\u2026</option>
            {topLevelCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, paddingBottom: 8 }}>
          <input type="checkbox" checked={activeFlag} onChange={(e) => setActiveFlag(e.target.checked)} /> Active
        </label>
      </div>

      {type === "rent" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <LabeledInput label="Monthly rent ($)" value={monthlyRent} onChange={setMonthlyRent} type="number" />
          <LabeledInput label="Escalation % (applies from renewal/anniversary month)" value={escalationPct} onChange={setEscalationPct} type="number" />
          <LabeledInput label="Lease start" value={leaseStart} onChange={setLeaseStart} type="date" />
          <LabeledInput label="Lease end" value={leaseEnd} onChange={setLeaseEnd} type="date" />
        </div>
      )}
      {type === "consultant" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <LabeledInput label="Fee ($)" value={fee} onChange={setFee} type="number" />
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Frequency</div>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={styles.yearSelect}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <LabeledInput label="Contract start" value={contractStart} onChange={setContractStart} type="date" />
          <LabeledInput label="Contract end" value={contractEnd} onChange={setContractEnd} type="date" />
          {frequency === "one_time" && (
            <div>
              <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Which month?</div>
              <select value={oneTimeMonth} onChange={(e) => setOneTimeMonth(parseInt(e.target.value, 10))} style={styles.yearSelect}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      {type === "subscription" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <LabeledInput label="Monthly amount ($)" value={monthlyAmount} onChange={setMonthlyAmount} type="number" />
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Billing cycle</div>
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} style={styles.yearSelect}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <LabeledInput label="Renewal date" value={renewalDate} onChange={setRenewalDate} type="date" />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
        <button onClick={handleSave} style={styles.primaryBtn} disabled={!name.trim() || !categoryId}>Save</button>
      </div>
    </div>
  );
}

// `required` renders a red star after the label — the one consistent mark
// for "this field blocks Save if left empty" across every form in the app
// (RequiredStar below is the same span reused directly in forms that don't
// go through LabeledInput, e.g. AddVendorModal's plain <label>).
function RequiredStar() {
  return <span style={{ color: "#C00000" }} aria-hidden="true"> *</span>;
}
function LabeledInput({ label, value, onChange, type, required }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>{label}{required && <RequiredStar />}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...styles.chatInput, background: "#FFFFFF", width: 140 }} />
    </div>
  );
}

// ---- Budget & Variance ------------------------------------------------------
function BudgetVarianceView({ year, isEditableYear, activeBudgetingYear, budgetLines, rollup, categories, generating, onGenerate, onOverride, fmtN }) {
  const [editingCell, setEditingCell] = useState(null); // "lineId|monthIndex"
  const [editVal, setEditVal] = useState("");

  const actualsByLineId = {};
  for (const cat of rollup) {
    if (cat.subcategories && cat.subcategories.length > 0) {
      for (const sub of cat.subcategories) actualsByLineId[sub.id] = sub.monthly;
    } else {
      actualsByLineId[cat.id] = cat.monthly;
    }
  }

  const lineName = (line) => categories.find(c => c.id === (line.subcategoryId || line.categoryId))?.name || line.id;

  const totals = { budget: new Array(12).fill(0), actual: new Array(12).fill(0) };
  budgetLines.forEach(line => { (line.monthlyAmount || []).forEach((v, i) => { totals.budget[i] += v || 0; }); });
  Object.values(actualsByLineId).forEach(monthly => { monthly.forEach((v, i) => { totals.actual[i] += v || 0; }); });
  const totalBudget = totals.budget.reduce((a, b) => a + b, 0);
  const totalActual = totals.actual.reduce((a, b) => a + b, 0);

  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={styles.panelTitle}>Budget vs Actual \u2014 {year}</div>
        {isEditableYear ? (
          <button onClick={onGenerate} disabled={generating} style={styles.primaryBtn}>
            {generating ? "Generating\u2026" : budgetLines.length > 0 ? "Regenerate Budget" : "Generate Budget"}
          </button>
        ) : (
          <span style={{ fontSize: 11.5, color: "#8A6D1A", background: "#FFF8E1", border: "1px solid #E8C468", borderRadius: 6, padding: "3px 8px" }}>
            Read-only \u2014 budget generation/editing is only enabled for {activeBudgetingYear}.
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 14 }}>
        Budget = an active agreement's terms where one exists, else last year's actual \u00d7 growth%, shaped to last year's own monthly pattern. Click a budget figure to override it manually \u2014 the original system estimate is kept even after an override.
      </div>

      {budgetLines.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6B6B6B" }}>No budget generated yet for {year}.</div>
      ) : (
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...styles.th, textAlign: "left", verticalAlign: "bottom" }}>Category</th>
                <th colSpan={12} style={{ ...styles.th, textAlign: "center", borderBottom: "1px solid #E0E0E0" }}>Budget</th>
                <th colSpan={12} style={{ ...styles.th, textAlign: "center", borderBottom: "1px solid #E0E0E0" }}>Actual</th>
                <th colSpan={12} style={{ ...styles.th, textAlign: "center", borderBottom: "1px solid #E0E0E0" }}>Variance</th>
                <th rowSpan={2} style={{ ...styles.th, fontWeight: 700 }}>Budget Total</th>
                <th rowSpan={2} style={{ ...styles.th, fontWeight: 700 }}>Actual Total</th>
              </tr>
              <tr>
                {MONTHS.map(m => <th key={`b${m}`} style={{ ...styles.th, fontSize: 10 }}>{m}</th>)}
                {MONTHS.map(m => <th key={`a${m}`} style={{ ...styles.th, fontSize: 10 }}>{m}</th>)}
                {MONTHS.map(m => <th key={`v${m}`} style={{ ...styles.th, fontSize: 10 }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {budgetLines.map(line => {
                const actual = actualsByLineId[line.id] || new Array(12).fill(0);
                const budgetTotal = (line.monthlyAmount || []).reduce((a, b) => a + b, 0);
                const actualTotal = actual.reduce((a, b) => a + b, 0);
                return (
                  <tr key={line.id} className="row-hover" style={styles.tr}>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {lineName(line)}
                      <span style={{ fontSize: 9.5, color: "#8A8A8A", marginLeft: 6, textTransform: "uppercase" }}>{line.source}</span>
                    </td>
                    {(line.monthlyAmount || new Array(12).fill(0)).map((v, i) => {
                      const cellKey = `${line.id}|${i}`;
                      return (
                        <td key={i} className="num" style={{ ...styles.td, fontSize: 10.5, cursor: isEditableYear ? "pointer" : "default" }}
                          onClick={() => { if (!isEditableYear) return; setEditingCell(cellKey); setEditVal(String(Math.round(v))); }}>
                          {editingCell === cellKey ? (
                            <input autoFocus className="num" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => { onOverride(line.id, i, parseFloat(editVal) || 0); setEditingCell(null); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { onOverride(line.id, i, parseFloat(editVal) || 0); setEditingCell(null); } if (e.key === "Escape") setEditingCell(null); }}
                              style={styles.gridCellInput} />
                          ) : fmtN(v)}
                        </td>
                      );
                    })}
                    {actual.map((v, i) => <td key={i} className="num" style={{ ...styles.td, fontSize: 10.5, color: "#6B6B6B" }}>{fmtN(v)}</td>)}
                    {(line.monthlyAmount || new Array(12).fill(0)).map((b, i) => {
                      const varAmt = (actual[i] || 0) - b;
                      return <td key={i} className="num" style={{ ...styles.td, fontSize: 10.5, color: varAmt <= 0 ? "#1B8A3A" : "#C00000" }}>{varAmt >= 0 ? "+" : ""}{fmtN(varAmt)}</td>;
                    })}
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(budgetTotal)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(actualTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111111" }}>
                <td style={{ ...styles.td, textAlign: "left", fontWeight: 700 }}>Total</td>
                {totals.budget.map((v, i) => <td key={i} className="num" style={{ ...styles.td, fontWeight: 700, fontSize: 10.5 }}>{fmtN(v)}</td>)}
                {totals.actual.map((v, i) => <td key={i} className="num" style={{ ...styles.td, fontWeight: 700, fontSize: 10.5 }}>{fmtN(v)}</td>)}
                {totals.budget.map((b, i) => {
                  const varAmt = (totals.actual[i] || 0) - b;
                  return <td key={i} className="num" style={{ ...styles.td, fontWeight: 700, fontSize: 10.5, color: varAmt <= 0 ? "#1B8A3A" : "#C00000" }}>{varAmt >= 0 ? "+" : ""}{fmtN(varAmt)}</td>;
                })}
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totalBudget)}</td>
                <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totalActual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Employee Cost Module (base) -------------------------------------------
const DEPARTMENTS = ["Finance and Ops", "Marketing", "Management", "HR and Admin", "PS", "Sales", "Presales", "Delivery", "Operations", "Leadership"];
const DEPT_COLORS = ["#E58B85", "#7FAAD9", "#7FC98F", "#EBB966", "#B69AE8", "#7FCBDB", "#E88F94", "#7FD4AC", "#D6BC7F", "#A6AFBD", "#E0A970", "#7FADCE", "#D998B0", "#8FC7C4", "#ABCB8A", "#B698D6"];

// Sub-region -> flag emoji(s). Single-country sub-regions get their exact
// flag; grouped regions (Levant, Arabic Africa, etc. — CIPR's Sub Region
// taxonomy mixes individual Gulf countries with broader multi-country
// groupings) get a representative cluster of a couple of flags from that
// group, since there's no single flag that's accurate for a grouping. A
// genuine choropleth map would need real GeoJSON boundary data per
// sub-region, which isn't available — this is the practical fallback.
const SUBREGION_FLAGS = {
  "KSA": "🇸🇦", "Saudi Arabia": "🇸🇦",
  "UAE": "🇦🇪",
  "Qatar": "🇶🇦",
  "Kuwait": "🇰🇼",
  "Bahrain": "🇧🇭",
  "Oman": "🇴🇲",
  "Egypt": "🇪🇬",
  "Gulf": "🇸🇦🇦🇪",
  "Levant": "🇱🇧🇯🇴",
  "Arabic Africa": "🇪🇬🇲🇦",
  "French Africa": "🇸🇳🇨🇮",
  "Sub-Saharan Africa": "🌍",
  "Rest of the world": "🌐",
};
const flagFor = (name) => SUBREGION_FLAGS[name] || "🌍";

function EmployeesTab({ showToast, year }) {
  const { fmtN } = useNumberUnit();
  const [employees, setEmployees] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active | resigned | all
  const [expandedId, setExpandedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, th, vendorRows] = await Promise.all([
        getEmployees(), getBenefitThresholds(), getVendors(year),
      ]);
      setEmployees(emps);
      setThresholds(th);
      setVendorOptions(vendorRows.map(v => v.vendor).sort());
      // Sub-regions (CIPR's "Sub Region" taxonomy — KSA/UAE/Qatar/Levant/
      // etc.), not countries — derived from the union of every vendor's
      // own `regions` field, the same source VendorPerformanceView's
      // region filter already uses, rather than getRegions() which
      // returns country-level entries (a different granularity).
      let subRegions = [...new Set(vendorRows.flatMap(v => v.regions || []))];
      if (subRegions.length === 0) {
        // `regions` only populates from real actuals data — for the active
        // budgeting year (no actuals yet), this comes back empty. Sub-
        // region names are a stable taxonomy independent of which year is
        // being planned, so fall back to the current calendar year (which
        // should have real synced data) rather than showing an empty picker.
        try {
          const fallbackVendors = await getVendors(new Date().getFullYear());
          subRegions = [...new Set(fallbackVendors.flatMap(v => v.regions || []))];
        } catch (e) { /* not fatal — picker just stays empty if this also fails */ }
      }
      setRegionOptions(subRegions.sort());
    } catch (e) {
      console.error("EmployeesTab load failed:", e);
      showToast(`Couldn't load employee data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [year]);

  const isResignedInOrBefore = (e) => e.resignationDate && new Date(e.resignationDate) <= new Date(year, 11, 31);
  const filtered = employees.filter(e => {
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase()) && !e.employeeNo?.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter && e.department !== deptFilter) return false;
    if (statusFilter === "active" && isResignedInOrBefore(e)) return false;
    if (statusFilter === "resigned" && !isResignedInOrBefore(e)) return false;
    return true;
  });

  const stats = employees.length ? computeEmployeeDashboardStats(employees, year) : null;

  const handleSaveEmployee = async (fields) => {
    try {
      if (editingEmployee) await updateEmployee(editingEmployee.id, fields);
      else await addEmployee(fields);
      setFormOpen(false); setEditingEmployee(null);
      await load();
      showToast(editingEmployee ? "Employee updated" : "Employee added");
    } catch (e) {
      showToast(`Couldn't save employee: ${e.message}`);
    }
  };

  const handleResign = async (id, name) => {
    const dateStr = window.prompt(`Resignation date for ${name} (YYYY-MM-DD):`);
    if (!dateStr) return;
    try {
      await resignEmployee(id, dateStr);
      await load();
      showToast(`${name} marked as resigned effective ${dateStr}`);
    } catch (e) {
      showToast(`Couldn't set resignation: ${e.message}`);
    }
  };

  const handleReinstate = async (id, name) => {
    try {
      await reinstateEmployee(id);
      await load();
      showToast(`${name} reinstated`);
    } catch (e) {
      showToast(`Couldn't reinstate: ${e.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete ${name}? This is for data-entry mistakes only — use "Mark as resigned" for real departures.`)) return;
    try {
      await deleteEmployee(id);
      await load();
    } catch (e) {
      showToast(`Couldn't delete: ${e.message}`);
    }
  };

  const handleSaveHikes = async (id, hikes) => {
    try {
      await setEmployeeHikes(id, year, hikes);
      await load();
      showToast("Hikes saved");
    } catch (e) {
      showToast(`Couldn't save hikes: ${e.message}`);
    }
  };

  const departmentData = stats ? Object.entries(stats.byDepartment).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) : [];
  const locationData = stats ? Object.entries(stats.byLocation).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) : [];

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: "#8A8A8A" }}>
          Employee master for {year}. Monthly cost is calculated from Basic + HRA + Other Allowance + VP, joining/resignation dates, and any hikes entered for this year — not hand-typed per cell.
        </div>
        <button onClick={() => { setEditingEmployee(null); setFormOpen(true); }} style={styles.primaryBtn}>+ Add Employee</button>
      </div>

      {stats && (
        <div style={styles.kpiGrid}>
          <KpiCard label="Active Employees" value={String(stats.totalActive)} sub={`${year}`} />
          <KpiCard label="New Hires (by quarter)" value={stats.newHiresByQuarter.join(" / ")} sub="Q1 / Q2 / Q3 / Q4" />
          <KpiCard label="Resigned This Year" value={String(stats.resignedThisYear)} />
          <KpiCard label="Total Annual Cost" value={fmtN(stats.totalAnnualCost)} />
        </div>
      )}

      {departmentData.length > 0 && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Headcount by Department</div>
          <ResponsiveContainer width="100%" height={Math.max(180, departmentData.length * 32)}>
            <BarChart data={departmentData} layout="vertical" margin={{ top: 6, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" allowDecimals={false} fontSize={12} stroke="#6B6B6B" />
              <YAxis type="category" dataKey="name" fontSize={12} stroke="#6B6B6B" width={140} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {departmentData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                <LabelList dataKey="value" position="right" fontSize={12} fill="#111111" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {locationData.length > 0 && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Headcount by Location</div>
          <ResponsiveContainer width="100%" height={Math.max(180, locationData.length * 32)}>
            <BarChart data={locationData} layout="vertical" margin={{ top: 6, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" allowDecimals={false} fontSize={12} stroke="#6B6B6B" />
              <YAxis type="category" dataKey="name" fontSize={12} stroke="#6B6B6B" width={140} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {locationData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                <LabelList dataKey="value" position="right" fontSize={12} fill="#111111" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {formOpen && (
        <EmployeeFormModal
          initial={editingEmployee}
          vendorOptions={vendorOptions} regionOptions={regionOptions}
          onCancel={() => { setFormOpen(false); setEditingEmployee(null); }}
          onSave={handleSaveEmployee}
        />
      )}

      <div style={styles.panel}>
        <div style={styles.tableToolbar}>
          <div style={styles.searchBox}><Search size={14} color="#6B6B6B" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or employee no…" style={styles.searchInput} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={styles.yearSelect}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.yearSelect}>
              <option value="active">Active</option>
              <option value="resigned">Resigned</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : filtered.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6B6B6B" }}>No employees match this filter.</div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Name</th>
                  {MONTHS.map(m => <th key={m} style={{ ...styles.th, fontSize: 10 }}>{m}</th>)}
                  <th style={{ ...styles.th, fontWeight: 700 }}>Total</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <EmployeeRow
                    key={e.id} employee={e} year={year} thresholds={thresholds}
                    expanded={expandedId === e.id} onToggleExpand={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    onEdit={() => { setEditingEmployee(e); setFormOpen(true); }}
                    onResign={() => handleResign(e.id, e.name)} onReinstate={() => handleReinstate(e.id, e.name)}
                    onDelete={() => handleDelete(e.id, e.name)} onSaveHikes={(hikes) => handleSaveHikes(e.id, hikes)}
                    fmtN={fmtN}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeRow({ employee, year, thresholds, expanded, onToggleExpand, onEdit, onResign, onReinstate, onDelete, onSaveHikes, fmtN }) {
  const monthly = computeEmployeeMonthlyCost(employee, year);
  const total = monthly.reduce((a, b) => a + b, 0);
  const isResigned = !!employee.resignationDate;
  return (
    <>
      <tr className="row-hover" style={{ ...styles.tr, cursor: "pointer" }} onClick={onToggleExpand}>
        <td style={{ ...styles.td, textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>
          {expanded ? <ChevronDown size={12} style={{ marginRight: 5, verticalAlign: -1 }} /> : <ChevronRight size={12} style={{ marginRight: 5, verticalAlign: -1 }} />}
          {employee.name}
          {isResigned && <span style={{ fontSize: 10, color: "#C00000", marginLeft: 6 }}>(resigned)</span>}
        </td>
        {monthly.map((v, i) => <td key={i} className="num" style={{ ...styles.td, fontSize: 10.5 }}>{v ? fmtN(v) : "—"}</td>)}
        <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(total)}</td>
        <td style={{ ...styles.td, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} style={{ ...styles.iconBtnGhost, width: 22, height: 22 }} title="Edit"><Sliders size={11} /></button>
          {isResigned ? (
            <button onClick={onReinstate} style={{ ...styles.iconBtnGhost, width: 22, height: 22, marginLeft: 4 }} title="Reinstate"><RotateCcw size={11} /></button>
          ) : (
            <button onClick={onResign} style={{ ...styles.iconBtnGhost, width: 22, height: 22, marginLeft: 4 }} title="Mark as resigned"><Clock size={11} /></button>
          )}
          <button onClick={onDelete} style={{ ...styles.iconBtnGhost, width: 22, height: 22, marginLeft: 4 }} title="Delete"><X size={11} /></button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={14} style={{ padding: 0, border: "none" }}>
            <EmployeeDetail employee={employee} year={year} thresholds={thresholds} onSaveHikes={onSaveHikes} fmtN={fmtN} />
          </td>
        </tr>
      )}
    </>
  );
}

function formatAllocation(value, kindLabel) {
  if (!value) return "—";
  if (typeof value === "string") return value; // pre-multiselect legacy data
  if (value.mode === "all") return `Allocated to all ${kindLabel}`;
  if (value.list && value.list.length) return value.list.join(", ");
  return "—";
}

function EmployeeDetail({ employee, year, thresholds, onSaveHikes, fmtN }) {
  const [hikes, setHikes] = useState((employee.hikes && employee.hikes[year]) || []);
  const eligibility = thresholds ? computeBenefitEligibility(employee, year, thresholds) : null;

  const addHike = () => setHikes(prev => [...prev, { effectiveMonth: 1, pct: 0 }]);
  const updateHike = (i, field, val) => setHikes(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
  const removeHike = (i) => setHikes(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div style={{ background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 10, padding: 14, margin: "6px 0" }}>
      <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginBottom: 14, fontSize: 12.5 }}>
        <div><span style={{ color: "#6B6B6B" }}>Employee No: </span><strong>{employee.employeeNo || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>Designation: </span><strong>{employee.designation || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>Department: </span><strong>{employee.department || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>Entity: </span><strong>{employee.entity || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>Country: </span><strong>{employee.country || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>Joining: </span><strong>{employee.joiningDate || "—"}</strong></div>
        {employee.resignationDate && <div><span style={{ color: "#6B6B6B" }}>Resigned: </span><strong>{employee.resignationDate}</strong></div>}
      </div>
      <div style={{ fontSize: 12.5, marginBottom: 14 }}>
        <div><span style={{ color: "#6B6B6B" }}>Vendor allocation: </span>{formatAllocation(employee.vendorAllocation, "vendors")}</div>
        <div><span style={{ color: "#6B6B6B" }}>Sub-Region allocation: </span>{formatAllocation(employee.regionAllocation, "sub-regions")}</div>
      </div>

      {eligibility && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", marginBottom: 6 }}>BENEFIT ELIGIBILITY</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(eligibility).map(([benefit, e]) => (
              <span key={benefit} style={{
                fontSize: 11, padding: "3px 9px", borderRadius: 6, textTransform: "capitalize",
                background: e.status === "eligible" ? "#E8F5E9" : e.status === "eligible_from" ? "#FFF8E1" : "#F0F0F0",
                color: e.status === "eligible" ? "#1B8A3A" : e.status === "eligible_from" ? "#8A6D1A" : "#8A8A8A",
              }}>
                {benefit}: {e.status === "eligible" ? "Eligible" : e.status === "eligible_from" ? `Eligible from ${MONTHS[e.fromMonth - 1]}` : "Not eligible this FY"}
                {e.overridden && " (override)"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", marginBottom: 6 }}>HIKES — {year}</div>
        {hikes.map((h, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 11.5 }}>Effective month</span>
            <select value={h.effectiveMonth} onChange={(e) => updateHike(i, "effectiveMonth", parseInt(e.target.value, 10))} style={{ ...styles.yearSelect, fontSize: 11.5, padding: "3px 8px" }}>
              {MONTHS.map((m, mi) => <option key={m} value={mi + 1}>{m}</option>)}
            </select>
            <input type="number" value={h.pct} onChange={(e) => updateHike(i, "pct", parseFloat(e.target.value) || 0)} style={{ ...styles.gridCellInput, position: "static", width: 60 }} />
            <span style={{ fontSize: 11.5 }}>%</span>
            <button onClick={() => removeHike(i)} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }}><X size={10} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={addHike} style={styles.secondaryBtn}>+ Add Hike</button>
          <button onClick={() => onSaveHikes(hikes)} style={styles.primaryBtn}>Save Hikes</button>
        </div>
      </div>
    </div>
  );
}

const EMPLOYEE_COUNTRIES = ["Dubai", "Saudi", "India", "Qatar", "Kuwait", "Bahrain", "Levant", "Oman", "Egypt", "South Africa", "North Africa"];

// Normalizes old data: vendorAllocation/regionAllocation used to be a free
// text string (spec's own stated fallback) before this became a proper
// multi-select. A string value is treated as unset rather than trying to
// parse it — the old text isn't lost (still on the record under this same
// field until saved over), just not pre-selected in the new picker.
function normalizeAllocation(value) {
  if (value && typeof value === "object" && (value.mode === "all" || value.mode === "list")) return value;
  return { mode: "all", list: [] };
}

// Multi-select with an "allocate to all" option, mutually exclusive with
// picking individual items — checking "all" clears any specific selection,
// and checking a specific item while "all" was active switches to list mode
// starting with just that item.
function AllocationMultiSelect({ label, options, value, onChange, allLabel }) {
  const mode = value?.mode || "all";
  const list = value?.list || [];

  const toggleAll = () => onChange({ mode: "all", list: [] });
  const toggleItem = (item) => {
    if (mode === "all") { onChange({ mode: "list", list: [item] }); return; }
    const has = list.includes(item);
    const newList = has ? list.filter(x => x !== item) : [...list, item];
    onChange(newList.length ? { mode: "list", list: newList } : { mode: "all", list: [] });
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>{label}</div>
      <div style={{ width: 240, maxHeight: 160, overflowY: "auto", border: "1px solid #E0E0E0", borderRadius: 7, padding: 8, background: "#FFFFFF" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #F0F0F0" }}>
          <input type="checkbox" checked={mode === "all"} onChange={toggleAll} /> {allLabel}
        </label>
        {(!options || options.length === 0) ? (
          <div style={{ fontSize: 11, color: "#8A8A8A" }}>No options loaded for this year yet.</div>
        ) : options.map(opt => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "2px 0" }}>
            <input type="checkbox" checked={mode === "list" && list.includes(opt)} onChange={() => toggleItem(opt)} /> {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function EmployeeFormModal({ initial, vendorOptions, regionOptions, onCancel, onSave }) {
  const [employeeNo, setEmployeeNo] = useState(initial?.employeeNo || "");
  const [name, setName] = useState(initial?.name || "");
  const [designation, setDesignation] = useState(initial?.designation || "");
  const [department, setDepartment] = useState(initial?.department || "");
  const [entity, setEntity] = useState(initial?.entity || "");
  const [country, setCountry] = useState(initial?.country || "");
  const [vendorAllocation, setVendorAllocation] = useState(normalizeAllocation(initial?.vendorAllocation));
  const [regionAllocation, setRegionAllocation] = useState(normalizeAllocation(initial?.regionAllocation));
  const [joiningDate, setJoiningDate] = useState(initial?.joiningDate || "");
  const [basic, setBasic] = useState(initial?.basic ?? "");
  const [hra, setHra] = useState(initial?.hra ?? "");
  const [otherAllowance, setOtherAllowance] = useState(initial?.otherAllowance ?? "");
  const [vp, setVp] = useState(initial?.vp ?? "");
  // Save used to just silently no-op (a disabled button, no explanation)
  // when Name/Joining date were missing — from the user's side that reads
  // as "I clicked Save and nothing happened." Now the button is always
  // clickable; a missing required field shows an actual message instead of
  // pretending the click didn't register. `saving` also covers the case
  // where the click DID work but the Firestore write just takes a moment —
  // without it there's no feedback during that gap either.
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !joiningDate) {
      setError(!name.trim() && !joiningDate ? "Name and Joining date are required." : !name.trim() ? "Name is required." : "Joining date is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({
        employeeNo: employeeNo.trim() || null, name: name.trim(), designation: designation.trim() || null,
        department: department || null, entity: entity.trim() || null, country: country || null,
        vendorAllocation, regionAllocation, joiningDate,
        basic: parseFloat(basic) || 0, hra: parseFloat(hra) || 0, otherAllowance: parseFloat(otherAllowance) || 0, vp: parseFloat(vp) || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={{ ...styles.modalCard, width: "85vw", maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{initial ? "Edit Employee" : "Add Employee"}</div>
          <button onClick={onCancel} style={styles.iconBtnGhost} title="Close"><X size={16} /></button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <LabeledInput label="Employee No." value={employeeNo} onChange={setEmployeeNo} type="text" />
          <LabeledInput label="Name" required value={name} onChange={setName} type="text" />
          <LabeledInput label="Designation" value={designation} onChange={setDesignation} type="text" />
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Department</div>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={styles.yearSelect}>
              <option value="">—</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <LabeledInput label="Entity" value={entity} onChange={setEntity} type="text" />
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Country</div>
            <select value={country} onChange={(e) => setCountry(e.target.value)} style={styles.yearSelect}>
              <option value="">—</option>
              {EMPLOYEE_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <LabeledInput label="Joining date" required value={joiningDate} onChange={setJoiningDate} type="date" />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
          <AllocationMultiSelect label="Vendor allocation" options={vendorOptions} value={vendorAllocation} onChange={setVendorAllocation} allLabel="Allocate to all vendors" />
          <AllocationMultiSelect label="Sub-Region allocation" options={regionOptions} value={regionAllocation} onChange={setRegionAllocation} allLabel="Allocate to all sub-regions" />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <LabeledInput label="Basic ($/mo)" value={basic} onChange={setBasic} type="number" />
          <LabeledInput label="HRA ($/mo)" value={hra} onChange={setHra} type="number" />
          <LabeledInput label="Other Allowance ($/mo)" value={otherAllowance} onChange={setOtherAllowance} type="number" />
          <LabeledInput label="VP ($/mo)" value={vp} onChange={setVp} type="number" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          {error && <div style={{ fontSize: 12, color: "#C00000", marginRight: "auto" }}>{error}</div>}
          <button onClick={onCancel} style={styles.secondaryBtn} disabled={saving}>Cancel</button>
          <button onClick={handleSave} style={styles.primaryBtn} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Vendor Management Performance View (historical/in-progress years) ----
// Only rendered for non-editable years — the active budgeting year keeps
// the original simple VendorsTab completely untouched, per the explicit
// requirement to keep budget entry uncluttered.
const QUICK_FILTERS = [
  ["all", "All"],
  ["needs_attention", "Needs Attention"],
  ["margin_risk", "Margin Risk"],
  ["on_track", "On Track"],
  ["ahead", "Ahead"],
];
const SORT_OPTIONS = [
  ["budget_revenue", "Budget Revenue"],
  ["ytdVarAmt", "Revenue Variance"],
  ["ytdAchievementPct", "Revenue Achievement %"],
  ["ytdGpVarAmt", "GP Variance"],
  ["actualGpPct", "GP%"],
  ["forecastVarAmt", "Forecast Variance"],
  ["forecastAchievementPct", "Forecast Achievement %"],
];

function VendorPerformanceView({ vendors, year, showToast, activeBudgetingYear }) {
  const { fmtN } = useNumberUnit();
  const completed = isYearCompleted(year);
  const yearClass = classifyYear(year, activeBudgetingYear);
  // Budgeting/future years have no actuals yet — nothing to show YTD,
  // variance, forecast, or status against. Only "current_year" (this
  // calendar year, in progress) gets the full performance-tracking format;
  // once a budgeting/future year rolls forward into being the current
  // year, it naturally starts showing this fuller format automatically,
  // since yearClass is derived from the real system date each render.
  const isBudgetingOrFuture = yearClass === "current_budgeting_year" || yearClass === "future_budgeting_year";
  const cutoffIdx = getActualCutoffMonthIndex(year);

  const [buHeadFilter, setBuHeadFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [metricView, setMetricView] = useState("revenue"); // "revenue" | "gp"
  const [sortKey, setSortKey] = useState("budget_revenue");
  const [sortDir, setSortDir] = useState("desc"); // desc = highest budget revenue first, per updated default
  const [drilldownVendor, setDrilldownVendor] = useState(null);
  const [managementForecasts, setManagementForecasts] = useState({});
  const [formulasOpen, setFormulasOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getManagementForecasts(year).then(mf => { if (!cancelled) setManagementForecasts(mf); }).catch(() => {});
    return () => { cancelled = true; };
  }, [year]);

  const enriched = useMemo(() => {
    return vendors.map(v => {
      const { fyForecastRevenue, fyForecastGp } = computeFySystemForecast(v, year);
      const status = computeVendorStatus(v);
      const ytdVarAmt = v.actual_revenue_ytd - v.ytd_budget_revenue;
      const ytdVarPct = v.ytd_budget_revenue ? ytdVarAmt / v.ytd_budget_revenue : (v.actual_revenue_ytd > 0 ? 1 : 0);
      const ytdAchievementPct = ytdVarPct + 1;
      const ytdGpVarAmt = v.actual_gp_ytd - v.ytd_budget_gp;
      const ytdGpVarPct = v.ytd_budget_gp ? ytdGpVarAmt / v.ytd_budget_gp : 0;
      const forecastVarAmt = fyForecastRevenue - v.budget_revenue;
      const forecastVarPct = v.budget_revenue ? forecastVarAmt / v.budget_revenue : 0;
      const forecastAchievementPct = v.budget_revenue ? fyForecastRevenue / v.budget_revenue : 0;
      const forecastGpVarAmt = fyForecastGp - v.budget_gp;
      const forecastGpVarPct = v.budget_gp ? forecastGpVarAmt / v.budget_gp : 0;
      const fyVarAmt = v.actual_revenue_ytd - v.budget_revenue; // completed-year variance: FY actual vs FY budget
      const fyVarPct = v.budget_revenue ? fyVarAmt / v.budget_revenue : 0;
      const fyGpVarAmt = v.actual_gp_ytd - v.budget_gp;
      const fyGpVarPct = v.budget_gp ? fyGpVarAmt / v.budget_gp : 0;
      const actualGpPct = v.actual_revenue_ytd ? v.actual_gp_ytd / v.actual_revenue_ytd : 0;
      const budgetGpPct = v.budget_revenue ? v.budget_gp / v.budget_revenue : 0;
      const mgmtForecast = managementForecasts[v.vendor]?.revenue;
      return {
        ...v, fyForecastRevenue, fyForecastGp, status,
        ytdVarAmt, ytdVarPct, ytdAchievementPct, ytdGpVarAmt, ytdGpVarPct,
        forecastVarAmt, forecastVarPct, forecastAchievementPct, forecastGpVarAmt, forecastGpVarPct,
        fyVarAmt, fyVarPct, fyGpVarAmt, fyGpVarPct,
        actualGpPct, budgetGpPct, mgmtForecast,
      };
    });
  }, [vendors, year, managementForecasts]);

  const buHeadOptions = useMemo(() => [...new Set(enriched.map(v => v.bu_head).filter(Boolean))].sort(), [enriched]);
  const regionOptions = useMemo(() => [...new Set(enriched.flatMap(v => v.regions || []))].sort(), [enriched]);

  const belowPlanCount = enriched.filter(v => v.ytdVarAmt < 0).length;
  const atRiskCount = enriched.filter(v => v.status === "margin_risk").length;
  const gpBelowBudgetCount = enriched.filter(v => v.actualGpPct < v.budgetGpPct - 0.01).length;
  const aheadCount = enriched.filter(v => v.ytdVarPct > 0.15).length;

  const filtered = useMemo(() => {
    let rows = enriched;
    if (buHeadFilter) rows = rows.filter(v => v.bu_head === buHeadFilter);
    if (regionFilter) rows = rows.filter(v => (v.regions || []).includes(regionFilter));
    if (vendorSearch) rows = rows.filter(v => v.vendor.toLowerCase().includes(vendorSearch.toLowerCase()));
    if (quickFilter === "needs_attention") rows = rows.filter(v => v.status === "needs_attention");
    else if (quickFilter === "margin_risk") rows = rows.filter(v => v.status === "margin_risk");
    else if (quickFilter === "on_track") rows = rows.filter(v => v.status === "on_track");
    else if (quickFilter === "ahead") rows = rows.filter(v => v.ytdVarPct > 0.15);
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir;
    });
  }, [enriched, buHeadFilter, regionFilter, vendorSearch, quickFilter, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleSetForecast = async (vendorName, value) => {
    try {
      await setManagementForecast(year, vendorName, value, auth.currentUser?.email || "unknown");
      setManagementForecasts(prev => ({ ...prev, [vendorName]: { revenue: value } }));
    } catch (e) {
      showToast(`Couldn't save management forecast: ${e.message}`);
    }
  };

  const varKey = metricView === "gp" ? "ytdGpVarAmt" : "ytdVarAmt";
  const varPctKey = metricView === "gp" ? "ytdGpVarPct" : "ytdVarPct";
  const fyVarKey = metricView === "gp" ? "fyGpVarAmt" : "fyVarAmt";
  const fyVarPctKey = metricView === "gp" ? "fyGpVarPct" : "fyVarPct";
  const forecastVarKey = metricView === "gp" ? "forecastGpVarAmt" : "forecastVarAmt";
  const forecastVarPctKey = metricView === "gp" ? "forecastGpVarPct" : "forecastVarPct";
  const budgetKey = metricView === "gp" ? "budget_gp" : "budget_revenue";
  const ytdBudgetKey = metricView === "gp" ? "ytd_budget_gp" : "ytd_budget_revenue";
  const actualKey = metricView === "gp" ? "actual_gp_ytd" : "actual_revenue_ytd";
  const fyForecastKey = metricView === "gp" ? "fyForecastGp" : "fyForecastRevenue";

  // Totals row — sums the currently filtered/searched vendor list, same
  // convention as VendorsTab's totals (budgeting-year table). Var/Var% are
  // derived from the summed budget & actual (not an average of each row's
  // own %), so the total's percentage is the correct weighted figure, not
  // a naive average across vendors of very different sizes.
  const totals = useMemo(() => {
    const sum = (key) => filtered.reduce((s, v) => s + (v[key] || 0), 0);
    const budget = sum(budgetKey), ytdBudget = sum(ytdBudgetKey), actual = sum(actualKey);
    const fyForecast = sum(fyForecastKey), mgmtForecast = sum("mgmtForecast");
    const varBase = completed ? budget : ytdBudget;
    const varTotal = actual - varBase;
    const forecastVarTotal = fyForecast - budget;
    return {
      budget, ytdBudget, actual, fyForecast, mgmtForecast, varTotal,
      varPct: varBase ? varTotal / varBase : 0,
      forecastVarTotal, forecastVarPct: budget ? forecastVarTotal / budget : 0,
      // "Balance to Do" — FY Budget minus Actual (YTD Actual for the
      // in-progress current year, FY Actual for completed years) — how much
      // budget is left unachieved. Not shown for budgeting/future years,
      // which have no actuals at all yet.
      balanceToDo: budget - actual,
    };
  }, [filtered, budgetKey, ytdBudgetKey, actualKey, fyForecastKey, completed]);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6B6B" }}>
          {completed ? `FY ${year} — Actuals through December (${YEAR_CLASSIFICATION_LABELS[yearClass]})`
            : isBudgetingOrFuture ? `FY ${year} Budget (${YEAR_CLASSIFICATION_LABELS[yearClass]}) — no actuals yet`
            : `Actuals through ${MONTHS[cutoffIdx] || MONTHS[0]} ${year} (${YEAR_CLASSIFICATION_LABELS[yearClass]})`}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setFormulasOpen(true)} style={{ ...styles.secondaryBtn, fontSize: 12 }} title="How these numbers are calculated">
            ƒ Formulas
          </button>
          <div style={styles.unitToggle}>
            {[["revenue", "Revenue"], ["gp", "GP"]].map(([val, label]) => (
              <button key={val} onClick={() => setMetricView(val)} style={{ ...styles.unitToggleBtn, ...(metricView === val ? styles.unitToggleBtnActive : {}) }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {formulasOpen && <FormulasModal onClose={() => setFormulasOpen(false)} />}

      {/* Management Attention summary — status-driven, so only shown for
          "current_year" (in-progress, has real actuals to judge pace
          against). Completed years have nothing left to track; budgeting/
          future years have no actuals yet to compute status from at all. */}
      {!completed && !isBudgetingOrFuture && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <AttentionCard label="Below Plan" value={belowPlanCount} color="#C00000" onClick={() => setQuickFilter("needs_attention")} active={quickFilter === "needs_attention"} />
          <AttentionCard label="At Risk" value={atRiskCount} color="#7A3F9A" onClick={() => setQuickFilter("margin_risk")} active={quickFilter === "margin_risk"} />
          <AttentionCard label="GP% Below Budget" value={gpBelowBudgetCount} color="#8A6D1A" onClick={() => setMetricView("gp")} active={metricView === "gp"} />
          <AttentionCard label="Significantly Ahead" value={aheadCount} color="#1B8A3A" onClick={() => setQuickFilter("ahead")} active={quickFilter === "ahead"} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div style={styles.searchBox}><Search size={14} color="#6B6B6B" /><input value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Search vendor…" style={styles.searchInput} /></div>
        <select value={buHeadFilter} onChange={(e) => setBuHeadFilter(e.target.value)} style={styles.yearSelect}>
          <option value="">All BU Heads</option>
          {buHeadOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={styles.yearSelect}>
          <option value="">All Regions</option>
          {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {!completed && !isBudgetingOrFuture && (
          <div style={styles.plViewToggle}>
            {QUICK_FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setQuickFilter(k)} style={{ ...styles.plToggleBtn, ...(quickFilter === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
            ))}
          </div>
        )}
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} style={styles.yearSelect}>
          {(isBudgetingOrFuture ? [["budget_revenue", "Budget Revenue"], ["budget_gp", "Budget GP"]]
            : completed ? SORT_OPTIONS.filter(([k]) => !k.startsWith("forecast") && k !== "ytdVarAmt" && k !== "ytdAchievementPct" && k !== "ytdGpVarAmt")
            : SORT_OPTIONS).map(([k, label]) => <option key={k} value={k}>Sort: {label}</option>)}
        </select>
        <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} style={styles.iconBtnGhost} title="Reverse sort direction">
          <ChevronDown size={14} style={{ transform: sortDir === "asc" ? "none" : "rotate(180deg)" }} />
        </button>
      </div>

      <div style={styles.panel}>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            {isBudgetingOrFuture ? (
              <>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>Vendor</th>
                    <SortableTh label="FY Budget" sortKeyName={budgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.vendor} className="row-hover" style={{ ...styles.tr, cursor: "pointer" }} onClick={() => setDrilldownVendor(v)}>
                      <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>{v.vendor}</td>
                      <td className="num" style={styles.td}>{fmtN(v[budgetKey])}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #111111" }}>
                    <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget)}</td>
                  </tr>
                </tfoot>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>Vendor</th>
                    {!completed && <th style={{ ...styles.th, textAlign: "left" }}>Status</th>}
                    <SortableTh label="FY Budget" sortKeyName={budgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    {!completed && <SortableTh label="YTD Budget" sortKeyName={ytdBudgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    <SortableTh label={completed ? "FY Actual" : "YTD Actual"} sortKeyName={actualKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <th style={{ ...styles.th, textAlign: "right" }} title="FY Budget minus Actual — how much budget remains unachieved">Balance to Do</th>
                    <SortableTh label={completed ? "FY Var" : "YTD Var"} sortKeyName={completed ? fyVarKey : varKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label={completed ? "FY Var %" : "YTD Var %"} sortKeyName={completed ? fyVarPctKey : varPctKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    {!completed && <SortableTh label="FY Forecast (System)" sortKeyName={fyForecastKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    {!completed && <SortableTh label="Mgmt Forecast" sortKeyName="mgmtForecast" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    {!completed && <SortableTh label="Forecast Var" sortKeyName={forecastVarKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    {!completed && <SortableTh label="Forecast Var %" sortKeyName={forecastVarPctKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.vendor} className="row-hover" style={{ ...styles.tr, cursor: "pointer" }} onClick={() => setDrilldownVendor(v)}>
                      <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>{v.vendor}</td>
                      {!completed && (
                        <td style={{ ...styles.td, textAlign: "left" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 5, color: "#FFFFFF", background: STATUS_COLORS[v.status] }}>{STATUS_LABELS[v.status]}</span>
                        </td>
                      )}
                      <td className="num" style={styles.td}>{fmtN(v[budgetKey])}</td>
                      {!completed && <td className="num" style={styles.td}>{fmtN(v[ytdBudgetKey])}</td>}
                      <td className="num" style={styles.td}>{fmtN(v[actualKey])}</td>
                      <td className="num" style={styles.td}>{fmtN(v[budgetKey] - v[actualKey])}</td>
                      <td className="num" style={{ ...styles.td, color: v[completed ? fyVarKey : varKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{v[completed ? fyVarKey : varKey] >= 0 ? "+" : ""}{fmtN(v[completed ? fyVarKey : varKey])}</td>
                      <td className="num" style={{ ...styles.td, color: v[completed ? fyVarPctKey : varPctKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(v[completed ? fyVarPctKey : varPctKey])}</td>
                      {!completed && <td className="num" style={styles.td}>{fmtN(v[fyForecastKey])}</td>}
                      {!completed && (
                        <td className="num" style={styles.td} onClick={(e) => e.stopPropagation()}>
                          <ManagementForecastCell vendor={v.vendor} value={v.mgmtForecast} onSave={handleSetForecast} fmtN={fmtN} />
                        </td>
                      )}
                      {!completed && <td className="num" style={{ ...styles.td, color: v[forecastVarKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{v[forecastVarKey] >= 0 ? "+" : ""}{fmtN(v[forecastVarKey])}</td>}
                      {!completed && <td className="num" style={{ ...styles.td, color: v[forecastVarPctKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(v[forecastVarPctKey])}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #111111" }}>
                    <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                    {!completed && <td style={styles.td}></td>}
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget)}</td>
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.ytdBudget)}</td>}
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.actual)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.balanceToDo)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.varTotal >= 0 ? "#1B8A3A" : "#C00000" }}>{totals.varTotal >= 0 ? "+" : ""}{fmtN(totals.varTotal)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.varPct >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(totals.varPct)}</td>
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.fyForecast)}</td>}
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.mgmtForecast)}</td>}
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.forecastVarTotal >= 0 ? "#1B8A3A" : "#C00000" }}>{totals.forecastVarTotal >= 0 ? "+" : ""}{fmtN(totals.forecastVarTotal)}</td>}
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.forecastVarPct >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(totals.forecastVarPct)}</td>}
                  </tr>
                </tfoot>
              </>
            )}
          </table>
        </div>
      </div>

      {drilldownVendor && (
        <VendorDrilldownModal vendor={drilldownVendor} year={year} completed={completed} isBudgetingOrFuture={isBudgetingOrFuture} onClose={() => setDrilldownVendor(null)} fmtN={fmtN} />
      )}
    </div>
  );
}

// Clickable column header with a sort-direction arrow — click once to sort
// by this column (defaults to descending), click again to flip direction.
// Shared by VendorPerformanceView and RegionPerformanceView.
function SortableTh({ label, sortKeyName, sortKey, sortDir, onSort }) {
  const active = sortKey === sortKeyName;
  return (
    <th style={{ ...styles.th, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => onSort(sortKeyName)} title={`Sort by ${label}`}>
      {label} <span style={{ color: active ? "#111111" : "#C0C0C0", fontSize: 9 }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "▲▼"}</span>
    </th>
  );
}

function AttentionCard({ label, value, color, onClick, active }) {
  return (
    <button onClick={onClick} style={{ ...styles.panel, textAlign: "left", cursor: "pointer", border: active ? `2px solid ${color}` : styles.panel.border, padding: 14 }}>
      <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </button>
  );
}

function ManagementForecastCell({ vendor, value, onSave, fmtN }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value != null ? String(Math.round(value)) : "");
  if (!editing) {
    return (
      <span onClick={() => { setVal(value != null ? String(Math.round(value)) : ""); setEditing(true); }} style={{ cursor: "pointer", borderBottom: "1px dashed #C0C0C0" }} title="Click to set a management forecast">
        {value != null ? fmtN(value) : "— set —"}
      </span>
    );
  }
  return (
    <input
      autoFocus className="num" value={val} onChange={(e) => setVal(e.target.value)}
      onBlur={() => { setEditing(false); const n = parseFloat(val); if (!isNaN(n)) onSave(vendor, n); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }}
      style={{ ...styles.gridCellInput, position: "static", width: 90 }}
    />
  );
}

function FormulasModal({ onClose }) {
  const Row = ({ label, formula, note }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{label}</div>
      <div className="num" style={{ fontSize: 12.5, background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 6, padding: "6px 10px", marginBottom: note ? 4 : 0 }}>{formula}</div>
      {note && <div style={{ fontSize: 11.5, color: "#6B6B6B" }}>{note}</div>}
    </div>
  );
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, width: "90vw", maxWidth: 1000, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 4 }}>Formulas</div>
            <div style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 18 }}>How every number in this view is calculated.</div>
          </div>
          <button onClick={onClose} style={styles.iconBtnGhost} title="Close"><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Variance</div>
            <Row label="YTD Variance" formula="Actual Revenue (YTD) − YTD Budget" note="YTD Budget is the sum of only the months elapsed so far from the vendor's monthly budget phasing — not the full annual budget divided by 12, and not the full annual budget itself. This keeps the comparison apples-to-apples by time period." />
            <Row label="YTD Variance %" formula="YTD Variance ÷ YTD Budget" />
            <Row label="FY Variance (completed years only)" formula="FY Actual − FY Budget" note="Once a year is fully complete, there's no more YTD/forecast distinction — it's simply actual vs. the full annual budget." />

            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "18px 0 10px" }}>FY System Forecast</div>
            <Row
              label="FY System Forecast"
              formula="YTD Actual + (Remaining Months' Budget × YTD Run-Rate Ratio)"
              note="YTD Run-Rate Ratio = YTD Actual ÷ YTD Budget. The remaining months use the vendor's own budget phasing for their shape (so a back-loaded budget still gets a back-loaded forecast), scaled by how the vendor has actually been performing so far this year. If YTD Budget is 0, the ratio defaults to 1 (forecast the remaining months at their budgeted value)."
            />
            <Row label="Forecast Variance" formula="FY System Forecast − FY Budget" />
            <Row label="Forecast Achievement %" formula="FY System Forecast ÷ FY Budget" />
            <Row label="Management Forecast" formula="Manually entered — no formula" note="An editable override alongside the System Forecast, for management's own judgment. Doesn't affect the System Forecast calculation." />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Status</div>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>Considers both revenue pace and margin health — a vendor can hit its revenue number on razor-thin GP% and still be flagged.</div>
            <Row label="Margin Risk" formula="Actual GP% is 3+ percentage points below Budget GP%" note="Checked first — takes priority over revenue pace, regardless of how revenue is tracking." />
            <Row label="Needs Attention" formula="YTD Revenue Achievement % < 80%" note="YTD Revenue Achievement % = Actual Revenue (YTD) ÷ YTD Budget." />
            <Row label="Watch" formula="YTD Revenue Achievement % between 80% and 95%" />
            <Row label="On Track" formula="Everything else — 95%+ achievement with no margin gap" />
            <div style={{ fontSize: 11, color: "#8A8A8A", marginTop: 4 }}>These thresholds (3pts, 80%, 95%) are a reasonable starting point, not a validated policy — worth tuning if they don't match how the business actually thinks about "at risk."</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={styles.secondaryBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

function VendorDrilldownModal({ vendor, year, completed, isBudgetingOrFuture, onClose, fmtN }) {
  const { unit } = useNumberUnit();
  const chartData = MONTHS.map((m, i) => ({
    month: m,
    "Budget Revenue": Math.round(vendor.monthly_budget_revenue[i] || 0),
    ...(isBudgetingOrFuture ? {} : { "Actual Revenue": vendor.monthly_actual_revenue[i] || null }),
  }));
  const gpChartData = MONTHS.map((m, i) => ({
    month: m,
    "Budget GP": Math.round(vendor.monthly_budget_gp[i] || 0),
    ...(isBudgetingOrFuture ? {} : { "Actual GP": vendor.monthly_actual_gp[i] || null }),
  }));
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, width: "90vw", maxWidth: 1000, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{vendor.vendor}</div>
            <div style={{ fontSize: 12, color: "#6B6B6B" }}>
              {vendor.bu_head ? `BU Head: ${vendor.bu_head}` : "BU Head: —"} · {(vendor.regions || []).length ? `Sub-Regions: ${vendor.regions.join(", ")}` : "Sub-Regions: —"}
              {vendor.tier && ` · Tier: ${vendor.tier}`}
            </div>
          </div>
          {!isBudgetingOrFuture && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, color: "#FFFFFF", background: STATUS_COLORS[vendor.status] }}>{STATUS_LABELS[vendor.status]}</span>}
          <button onClick={onClose} style={{ ...styles.iconBtnGhost, marginLeft: 10, flexShrink: 0 }} title="Close"><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isBudgetingOrFuture ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, margin: "16px 0" }}>
          <DrilldownStat label="FY Budget" value={fmtN(vendor.budget_revenue)} />
          {isBudgetingOrFuture ? (
            <DrilldownStat label="FY Budget GP" value={fmtN(vendor.budget_gp)} />
          ) : completed ? (
            <>
              <DrilldownStat label="FY Actual" value={fmtN(vendor.actual_revenue_ytd)} />
              <DrilldownStat label="FY Variance" value={`${vendor.fyVarAmt >= 0 ? "+" : ""}${fmtN(vendor.fyVarAmt)}`} color={vendor.fyVarAmt >= 0 ? "#1B8A3A" : "#C00000"} />
              <DrilldownStat label="FY Var %" value={fmtSignedPct(vendor.fyVarPct)} color={vendor.fyVarPct >= 0 ? "#1B8A3A" : "#C00000"} />
            </>
          ) : (
            <>
              <DrilldownStat label="YTD Achievement" value={fmtPct(vendor.ytdAchievementPct)} />
              <DrilldownStat label="FY System Forecast" value={fmtN(vendor.fyForecastRevenue)} />
              <DrilldownStat label="Forecast Achievement" value={fmtPct(vendor.forecastAchievementPct)} />
            </>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{isBudgetingOrFuture ? "Revenue — Budget Phasing" : "Revenue — Budget vs Actual"}</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" fontSize={11} stroke="#6B6B6B" />
            <YAxis fontSize={11} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
            <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="Budget Revenue" stroke="#6B6B6B" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {!isBudgetingOrFuture && <Line type="monotone" dataKey="Actual Revenue" stroke="#C00000" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>{isBudgetingOrFuture ? "Gross Profit — Budget Phasing" : "Gross Profit — Budget vs Actual"}</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={gpChartData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" fontSize={11} stroke="#6B6B6B" />
            <YAxis fontSize={11} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
            <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="Budget GP" stroke="#6B6B6B" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {!isBudgetingOrFuture && <Line type="monotone" dataKey="Actual GP" stroke="#1B8A3A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>

        {!isBudgetingOrFuture && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>Sub-Region Performance — Actual Revenue</div>
            {Object.keys(vendor.region_revenue || {}).length === 0 ? (
              <div style={{ fontSize: 12, color: "#6B6B6B" }}>No sub-region breakdown available for this vendor.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, Object.keys(vendor.region_revenue).length * 34)}>
                <BarChart
                  data={Object.entries(vendor.region_revenue).map(([name, rev]) => ({ subRegion: `${flagFor(name)} ${name}`, Revenue: Math.round(rev) })).sort((a, b) => b.Revenue - a.Revenue)}
                  layout="vertical" margin={{ top: 6, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                  <XAxis type="number" fontSize={11} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} />
                  <YAxis type="category" dataKey="subRegion" fontSize={11} stroke="#6B6B6B" width={130} />
                  <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
                  <Bar dataKey="Revenue" fill="#C00000" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={styles.secondaryBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DrilldownStat({ label, value, color }) {
  return (
    <div style={{ background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "#6B6B6B", fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div className="num" style={{ fontSize: 16, fontWeight: 700, color: color || "#111111" }}>{value}</div>
    </div>
  );
}

// ---- Region Management Performance View (historical/in-progress years) ---
// Mirrors VendorPerformanceView's structure/logic exactly (reuses the same
// computeFySystemForecast/computeVendorStatus — region rows are shaped
// identically to vendor rows so no region-specific version of either was
// needed), plus a region/sub-region/country granularity toggle that
// vendors don't have. Not built: a "Management Forecast" override — that
// was scoped as a per-vendor judgment call in the original ask; flagging
// this as an intentional omission, not an oversight, in case regions
// should have one too.
function RegionPerformanceView({ year, showToast, activeBudgetingYear, scenario }) {
  const { fmtN } = useNumberUnit();
  const completed = isYearCompleted(year);
  const yearClass = classifyYear(year, activeBudgetingYear);
  const isBudgetingOrFuture = yearClass === "current_budgeting_year" || yearClass === "future_budgeting_year";
  const cutoffIdx = getActualCutoffMonthIndex(year);

  const [granularity, setGranularity] = useState("subRegion"); // "region" | "subRegion" | "country"
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regionSearch, setRegionSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [metricView, setMetricView] = useState("revenue");
  const [sortKey, setSortKey] = useState("budget_revenue");
  const [sortDir, setSortDir] = useState("desc");
  const [drilldownRegion, setDrilldownRegion] = useState(null);
  const [formulasOpen, setFormulasOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRegionPerformanceData(year, granularity, scenario)
      .then(rows => { if (!cancelled) setRegions(rows); })
      .catch(e => { console.error("RegionPerformanceView load failed:", e); showToast(`Couldn't load region data: ${e.message}`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, granularity, scenario]);

  const enriched = useMemo(() => {
    return regions.map(r => {
      const { fyForecastRevenue, fyForecastGp } = computeFySystemForecast(r, year);
      const status = computeVendorStatus(r);
      const ytdVarAmt = r.actual_revenue_ytd - r.ytd_budget_revenue;
      const ytdVarPct = r.ytd_budget_revenue ? ytdVarAmt / r.ytd_budget_revenue : (r.actual_revenue_ytd > 0 ? 1 : 0);
      const ytdGpVarAmt = r.actual_gp_ytd - r.ytd_budget_gp;
      const ytdGpVarPct = r.ytd_budget_gp ? ytdGpVarAmt / r.ytd_budget_gp : 0;
      const forecastVarAmt = fyForecastRevenue - r.budget_revenue;
      const forecastVarPct = r.budget_revenue ? forecastVarAmt / r.budget_revenue : 0;
      const forecastAchievementPct = r.budget_revenue ? fyForecastRevenue / r.budget_revenue : 0;
      const forecastGpVarAmt = fyForecastGp - r.budget_gp;
      const forecastGpVarPct = r.budget_gp ? forecastGpVarAmt / r.budget_gp : 0;
      const fyVarAmt = r.actual_revenue_ytd - r.budget_revenue;
      const fyVarPct = r.budget_revenue ? fyVarAmt / r.budget_revenue : 0;
      const fyGpVarAmt = r.actual_gp_ytd - r.budget_gp;
      const fyGpVarPct = r.budget_gp ? fyGpVarAmt / r.budget_gp : 0;
      const actualGpPct = r.actual_revenue_ytd ? r.actual_gp_ytd / r.actual_revenue_ytd : 0;
      const budgetGpPct = r.budget_revenue ? r.budget_gp / r.budget_revenue : 0;
      return {
        ...r, fyForecastRevenue, fyForecastGp, status,
        ytdVarAmt, ytdVarPct, ytdGpVarAmt, ytdGpVarPct,
        forecastVarAmt, forecastVarPct, forecastAchievementPct, forecastGpVarAmt, forecastGpVarPct,
        fyVarAmt, fyVarPct, fyGpVarAmt, fyGpVarPct,
        actualGpPct, budgetGpPct,
      };
    });
  }, [regions, year]);

  const belowPlanCount = enriched.filter(r => r.ytdVarAmt < 0).length;
  const atRiskCount = enriched.filter(r => r.status === "margin_risk").length;
  const gpBelowBudgetCount = enriched.filter(r => r.actualGpPct < r.budgetGpPct - 0.01).length;
  const aheadCount = enriched.filter(r => r.ytdVarPct > 0.15).length;

  const filtered = useMemo(() => {
    let rows = enriched;
    if (regionSearch) rows = rows.filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase()));
    if (quickFilter === "needs_attention") rows = rows.filter(r => r.status === "needs_attention");
    else if (quickFilter === "margin_risk") rows = rows.filter(r => r.status === "margin_risk");
    else if (quickFilter === "on_track") rows = rows.filter(r => r.status === "on_track");
    else if (quickFilter === "ahead") rows = rows.filter(r => r.ytdVarPct > 0.15);
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * dir;
    });
  }, [enriched, regionSearch, quickFilter, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const varKey = metricView === "gp" ? "ytdGpVarAmt" : "ytdVarAmt";
  const varPctKey = metricView === "gp" ? "ytdGpVarPct" : "ytdVarPct";
  const fyVarKey = metricView === "gp" ? "fyGpVarAmt" : "fyVarAmt";
  const fyVarPctKey = metricView === "gp" ? "fyGpVarPct" : "fyVarPct";
  const forecastVarKey = metricView === "gp" ? "forecastGpVarAmt" : "forecastVarAmt";
  const forecastVarPctKey = metricView === "gp" ? "forecastGpVarPct" : "forecastVarPct";
  const budgetKey = metricView === "gp" ? "budget_gp" : "budget_revenue";
  const ytdBudgetKey = metricView === "gp" ? "ytd_budget_gp" : "ytd_budget_revenue";
  const actualKey = metricView === "gp" ? "actual_gp_ytd" : "actual_revenue_ytd";
  const fyForecastKey = metricView === "gp" ? "fyForecastGp" : "fyForecastRevenue";
  const granularityLabel = { region: "Region", subRegion: "Sub-Region", country: "Country" };

  // Same totals-row convention as VendorPerformanceView — sums the
  // filtered/searched list, Var% derived from summed budget & actual
  // rather than averaging each row's own %. No mgmtForecast here since
  // region-level Management Forecast doesn't exist (see PROJECT_HANDOFF).
  const totals = useMemo(() => {
    const sum = (key) => filtered.reduce((s, r) => s + (r[key] || 0), 0);
    const budget = sum(budgetKey), ytdBudget = sum(ytdBudgetKey), actual = sum(actualKey);
    const fyForecast = sum(fyForecastKey);
    const varBase = completed ? budget : ytdBudget;
    const varTotal = actual - varBase;
    const forecastVarTotal = fyForecast - budget;
    return {
      budget, ytdBudget, actual, fyForecast, varTotal,
      varPct: varBase ? varTotal / varBase : 0,
      forecastVarTotal, forecastVarPct: budget ? forecastVarTotal / budget : 0,
    };
  }, [filtered, budgetKey, ytdBudgetKey, actualKey, fyForecastKey, completed]);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6B6B" }}>
          {completed ? `FY ${year} — Actuals through December (${YEAR_CLASSIFICATION_LABELS[yearClass]})`
            : isBudgetingOrFuture ? `FY ${year} Budget (${YEAR_CLASSIFICATION_LABELS[yearClass]}) — no actuals yet`
            : `Actuals through ${MONTHS[cutoffIdx] || MONTHS[0]} ${year} (${YEAR_CLASSIFICATION_LABELS[yearClass]})`}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setFormulasOpen(true)} style={{ ...styles.secondaryBtn, fontSize: 12 }} title="How these numbers are calculated">ƒ Formulas</button>
          <div style={styles.unitToggle}>
            {[["revenue", "Revenue"], ["gp", "GP"]].map(([val, label]) => (
              <button key={val} onClick={() => setMetricView(val)} style={{ ...styles.unitToggleBtn, ...(metricView === val ? styles.unitToggleBtnActive : {}) }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {formulasOpen && <FormulasModal onClose={() => setFormulasOpen(false)} />}

      {!completed && !isBudgetingOrFuture && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <AttentionCard label="Below Plan" value={belowPlanCount} color="#C00000" onClick={() => setQuickFilter("needs_attention")} active={quickFilter === "needs_attention"} />
          <AttentionCard label="At Risk" value={atRiskCount} color="#7A3F9A" onClick={() => setQuickFilter("margin_risk")} active={quickFilter === "margin_risk"} />
          <AttentionCard label="GP% Below Budget" value={gpBelowBudgetCount} color="#8A6D1A" onClick={() => setMetricView("gp")} active={metricView === "gp"} />
          <AttentionCard label="Significantly Ahead" value={aheadCount} color="#1B8A3A" onClick={() => setQuickFilter("ahead")} active={quickFilter === "ahead"} />
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6, alignItems: "center" }}>
        <div style={styles.searchBox}><Search size={14} color="#6B6B6B" /><input value={regionSearch} onChange={(e) => setRegionSearch(e.target.value)} placeholder={`Search ${granularityLabel[granularity].toLowerCase()}…`} style={styles.searchInput} /></div>
        <div style={styles.plViewToggle}>
          {[["region", "Region"], ["subRegion", "Sub-Region"], ["country", "Country"]].map(([k, label]) => (
            <button key={k} onClick={() => setGranularity(k)} style={{ ...styles.plToggleBtn, ...(granularity === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
          ))}
        </div>
        {!completed && !isBudgetingOrFuture && (
          <div style={styles.plViewToggle}>
            {QUICK_FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setQuickFilter(k)} style={{ ...styles.plToggleBtn, ...(quickFilter === k ? styles.plToggleBtnActive : {}) }}>{label}</button>
            ))}
          </div>
        )}
      </div>
      {granularity === "country" && (
        <div style={{ fontSize: 11, color: "#8A8A8A", marginBottom: 14 }}>
          Country-level budget and actuals come from different source columns (Zoho's budget "Country" field vs. CIPR's "Billing Country") and may not always match by name — Region and Sub-Region granularity don't have this risk, since both sources carry those exact same attributes.
        </div>
      )}

      <div style={styles.panel}>
        {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : filtered.length === 0 ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>No data for this filter.</div> : (
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            {isBudgetingOrFuture ? (
              <>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>{granularityLabel[granularity]}</th>
                    <SortableTh label="FY Budget" sortKeyName={budgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.name} className="row-hover" style={{ ...styles.tr, cursor: "pointer" }} onClick={() => setDrilldownRegion(r)}>
                      <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>{r.name}</td>
                      <td className="num" style={styles.td}>{fmtN(r[budgetKey])}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #111111" }}>
                    <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget)}</td>
                  </tr>
                </tfoot>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.thStickyCol, textAlign: "left" }}>{granularityLabel[granularity]}</th>
                    {!completed && <th style={{ ...styles.th, textAlign: "left" }}>Status</th>}
                    <SortableTh label="FY Budget" sortKeyName={budgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    {!completed && <SortableTh label="YTD Budget" sortKeyName={ytdBudgetKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    <SortableTh label={completed ? "FY Actual" : "YTD Actual"} sortKeyName={actualKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label={completed ? "FY Var" : "YTD Var"} sortKeyName={completed ? fyVarKey : varKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label={completed ? "FY Var %" : "YTD Var %"} sortKeyName={completed ? fyVarPctKey : varPctKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    {!completed && <SortableTh label="FY Forecast (System)" sortKeyName={fyForecastKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    {!completed && <SortableTh label="Forecast Var" sortKeyName={forecastVarKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                    {!completed && <SortableTh label="Forecast Var %" sortKeyName={forecastVarPctKey} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.name} className="row-hover" style={{ ...styles.tr, cursor: "pointer" }} onClick={() => setDrilldownRegion(r)}>
                      <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 600 }}>{r.name}</td>
                      {!completed && (
                        <td style={{ ...styles.td, textAlign: "left" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 5, color: "#FFFFFF", background: STATUS_COLORS[r.status] }}>{STATUS_LABELS[r.status]}</span>
                        </td>
                      )}
                      <td className="num" style={styles.td}>{fmtN(r[budgetKey])}</td>
                      {!completed && <td className="num" style={styles.td}>{fmtN(r[ytdBudgetKey])}</td>}
                      <td className="num" style={styles.td}>{fmtN(r[actualKey])}</td>
                      <td className="num" style={{ ...styles.td, color: r[completed ? fyVarKey : varKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{r[completed ? fyVarKey : varKey] >= 0 ? "+" : ""}{fmtN(r[completed ? fyVarKey : varKey])}</td>
                      <td className="num" style={{ ...styles.td, color: r[completed ? fyVarPctKey : varPctKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(r[completed ? fyVarPctKey : varPctKey])}</td>
                      {!completed && <td className="num" style={styles.td}>{fmtN(r[fyForecastKey])}</td>}
                      {!completed && <td className="num" style={{ ...styles.td, color: r[forecastVarKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{r[forecastVarKey] >= 0 ? "+" : ""}{fmtN(r[forecastVarKey])}</td>}
                      {!completed && <td className="num" style={{ ...styles.td, color: r[forecastVarPctKey] >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(r[forecastVarPctKey])}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #111111" }}>
                    <td style={{ ...styles.td, ...styles.tdStickyCol, textAlign: "left", fontWeight: 700 }}>Total</td>
                    {!completed && <td style={styles.td}></td>}
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.budget)}</td>
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.ytdBudget)}</td>}
                    <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.actual)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.varTotal >= 0 ? "#1B8A3A" : "#C00000" }}>{totals.varTotal >= 0 ? "+" : ""}{fmtN(totals.varTotal)}</td>
                    <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.varPct >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(totals.varPct)}</td>
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700 }}>{fmtN(totals.fyForecast)}</td>}
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.forecastVarTotal >= 0 ? "#1B8A3A" : "#C00000" }}>{totals.forecastVarTotal >= 0 ? "+" : ""}{fmtN(totals.forecastVarTotal)}</td>}
                    {!completed && <td className="num" style={{ ...styles.td, fontWeight: 700, color: totals.forecastVarPct >= 0 ? "#1B8A3A" : "#C00000" }}>{fmtSignedPct(totals.forecastVarPct)}</td>}
                  </tr>
                </tfoot>
              </>
            )}
          </table>
        </div>
        )}
      </div>

      {drilldownRegion && (
        <RegionDrilldownModal region={drilldownRegion} year={year} completed={completed} isBudgetingOrFuture={isBudgetingOrFuture} granularityLabel={granularityLabel[granularity]} onClose={() => setDrilldownRegion(null)} fmtN={fmtN} />
      )}
    </div>
  );
}

function RegionDrilldownModal({ region, year, completed, isBudgetingOrFuture, granularityLabel, onClose, fmtN }) {
  const { unit } = useNumberUnit();
  const chartData = MONTHS.map((m, i) => ({
    month: m,
    "Budget Revenue": Math.round(region.monthly_budget_revenue[i] || 0),
    ...(isBudgetingOrFuture ? {} : { "Actual Revenue": region.monthly_actual_revenue[i] || null }),
  }));
  const gpChartData = MONTHS.map((m, i) => ({
    month: m,
    "Budget GP": Math.round(region.monthly_budget_gp[i] || 0),
    ...(isBudgetingOrFuture ? {} : { "Actual GP": region.monthly_actual_gp[i] || null }),
  }));
  const fyVarAmt = region.actual_revenue_ytd - region.budget_revenue;
  const fyVarPct = region.budget_revenue ? fyVarAmt / region.budget_revenue : 0;
  const ytdAchievementPct = region.ytd_budget_revenue ? region.actual_revenue_ytd / region.ytd_budget_revenue : 0;
  const forecastAchievementPct = region.budget_revenue ? region.fyForecastRevenue / region.budget_revenue : 0;
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, width: "90vw", maxWidth: 1000, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{region.name}</div>
            <div style={{ fontSize: 12, color: "#6B6B6B" }}>{granularityLabel}</div>
          </div>
          {!completed && !isBudgetingOrFuture && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, color: "#FFFFFF", background: STATUS_COLORS[region.status] }}>{STATUS_LABELS[region.status]}</span>}
          <button onClick={onClose} style={{ ...styles.iconBtnGhost, marginLeft: 10, flexShrink: 0 }} title="Close"><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isBudgetingOrFuture ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, margin: "16px 0" }}>
          <DrilldownStat label="FY Budget" value={fmtN(region.budget_revenue)} />
          {isBudgetingOrFuture ? (
            <DrilldownStat label="FY Budget GP" value={fmtN(region.budget_gp)} />
          ) : completed ? (
            <>
              <DrilldownStat label="FY Actual" value={fmtN(region.actual_revenue_ytd)} />
              <DrilldownStat label="FY Variance" value={`${fyVarAmt >= 0 ? "+" : ""}${fmtN(fyVarAmt)}`} color={fyVarAmt >= 0 ? "#1B8A3A" : "#C00000"} />
              <DrilldownStat label="FY Var %" value={fmtSignedPct(fyVarPct)} color={fyVarPct >= 0 ? "#1B8A3A" : "#C00000"} />
            </>
          ) : (
            <>
              <DrilldownStat label="YTD Achievement" value={fmtPct(ytdAchievementPct)} />
              <DrilldownStat label="FY System Forecast" value={fmtN(region.fyForecastRevenue)} />
              <DrilldownStat label="Forecast Achievement" value={fmtPct(forecastAchievementPct)} />
            </>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{isBudgetingOrFuture ? "Revenue — Budget Phasing" : "Revenue — Budget vs Actual"}</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" fontSize={11} stroke="#6B6B6B" />
            <YAxis fontSize={11} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
            <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="Budget Revenue" stroke="#6B6B6B" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {!isBudgetingOrFuture && <Line type="monotone" dataKey="Actual Revenue" stroke="#C00000" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>{isBudgetingOrFuture ? "Gross Profit — Budget Phasing" : "Gross Profit — Budget vs Actual"}</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={gpChartData} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" fontSize={11} stroke="#6B6B6B" />
            <YAxis fontSize={11} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} width={yAxisWidthForUnit(unit)} />
            <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="Budget GP" stroke="#6B6B6B" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {!isBudgetingOrFuture && <Line type="monotone" dataKey="Actual GP" stroke="#1B8A3A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={styles.secondaryBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---- Assumptions (presentation-ready, for COO/management visibility) -----
const ASSUMPTION_CATEGORIES = ["Data Sources", "Financial", "Budgeting", "Currency", "HR & Benefits", "Performance Thresholds"];

function AssumptionsTab({ showToast, skoUplift }) {
  const [assumptions, setAssumptions] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, benefitThresholds] = await Promise.all([getAssumptions(), getBenefitThresholds()]);
      setAssumptions(rows);
      setThresholds(benefitThresholds);
    } catch (e) {
      console.error("AssumptionsTab load failed:", e);
      showToast(`Couldn't load assumptions: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleSeed = async () => {
    try {
      await Promise.all(DEFAULT_ASSUMPTIONS.map(a => addAssumption(a)));
      await load();
      showToast(`Added ${DEFAULT_ASSUMPTIONS.length} example assumptions — edit or remove any of them freely.`);
    } catch (e) {
      showToast(`Couldn't seed assumptions: ${e.message}`);
    }
  };

  const handleSave = async (fields) => {
    try {
      if (editing) await updateAssumption(editing.id, fields);
      else await addAssumption(fields);
      setFormOpen(false); setEditing(null);
      await load();
    } catch (e) {
      showToast(`Couldn't save: ${e.message}`);
    }
  };

  const handleRemove = async (id, label) => {
    if (!window.confirm(`Remove "${label}"?`)) return;
    try {
      await removeAssumption(id);
      await load();
    } catch (e) {
      showToast(`Couldn't remove: ${e.message}`);
    }
  };

  const grouped = ASSUMPTION_CATEGORIES.map(cat => ({ category: cat, items: assumptions.filter(a => a.category === cat) }))
    .filter(g => g.items.length > 0);
  const otherItems = assumptions.filter(a => !ASSUMPTION_CATEGORIES.includes(a.category));
  if (otherItems.length) grouped.push({ category: "Other", items: otherItems });

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: "#8A8A8A" }}>
          A single place to see and edit the assumptions and data sources this app runs on — useful for a quick "what's this built on" review. Example/placeholder values below, not finalized finance policy.
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} style={styles.primaryBtn}>+ Add Assumption</button>
      </div>

      {formOpen && <AssumptionFormModal initial={editing} onCancel={() => { setFormOpen(false); setEditing(null); }} onSave={handleSave} />}

      {/* Live section — pulled directly from real running app config, not
          a separately-stored (and potentially stale) copy. */}
      <div style={styles.panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={styles.panelTitle}>Live System Configuration</div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#1B8A3A", background: "#E8F5E9", borderRadius: 4, padding: "2px 7px" }}>● LIVE</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 14 }}>These reflect the actual current app configuration, not a manually-entered value that could drift out of sync.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          <LiveAssumptionCard label="SKO Uplift" value={`${Math.round(skoUplift * 100)}%`} description="Applied to Macnica budget to approximate SKO budget (SKO actuals are real, pulled from CIPR's own inclusion flags — only budget is an uplift approximation)." />
          {thresholds && (
            <>
              <LiveAssumptionCard label="Insurance Eligibility" value={thresholds.insuranceMonths === 0 ? "Day 1" : `${thresholds.insuranceMonths} months`} description="Employee benefit eligibility, from Employees tab settings." />
              <LiveAssumptionCard label="Airfare Eligibility" value={`${thresholds.airfareMonths} months`} description="Employee benefit eligibility, from Employees tab settings." />
              <LiveAssumptionCard label="Gratuity Eligibility" value={`${thresholds.gratuityMonths} months`} description="Employee benefit eligibility, from Employees tab settings." />
              <LiveAssumptionCard label="ESOP Eligibility" value={`${thresholds.esopMonths} months`} description="Employee benefit eligibility, from Employees tab settings." />
            </>
          )}
          <LiveAssumptionCard label="Vendor Status: Margin Risk" value="GP% 3+ pts below budget" description="Checked first, takes priority over revenue pace — see Formulas popup on the Vendors tab." />
          <LiveAssumptionCard label="Vendor Status: Needs Attention" value="< 80% YTD achievement" description="Revenue pace threshold — see Formulas popup on the Vendors tab." />
          <LiveAssumptionCard label="Vendor Status: On Track" value="≥ 95% YTD achievement" description="Revenue pace threshold — see Formulas popup on the Vendors tab." />
        </div>
      </div>

      {loading ? <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading…</div> : assumptions.length === 0 ? (
        <div style={styles.panel}>
          <div style={styles.emptyState}>
            <div style={{ fontSize: 14, marginBottom: 10 }}>No assumptions added yet.</div>
            <button onClick={handleSeed} style={styles.primaryBtn}>+ Add Example Assumptions</button>
          </div>
        </div>
      ) : (
        grouped.map(g => (
          <div key={g.category} style={styles.panel}>
            <div style={styles.panelTitle}>{g.category}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 10 }}>
              {g.items.map(a => (
                <div key={a.id} style={{ background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 10, padding: 14, position: "relative" }}>
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 3 }}>
                    <button onClick={() => { setEditing(a); setFormOpen(true); }} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }} title="Edit"><Sliders size={10} /></button>
                    <button onClick={() => handleRemove(a.id, a.label)} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }} title="Remove"><X size={10} /></button>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B6B", marginBottom: 4 }}>{a.label}</div>
                  <div className="num" style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>{a.value}{a.unit ? ` ${a.unit}` : ""}</div>
                  {a.description && <div style={{ fontSize: 11.5, color: "#6B6B6B", lineHeight: 1.4 }}>{a.description}</div>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LiveAssumptionCard({ label, value, description }) {
  return (
    <div style={{ background: "#F0F8F0", border: "1px solid #C8E6C9", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#1B8A3A", marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6B6B6B", lineHeight: 1.4 }}>{description}</div>
    </div>
  );
}

function AssumptionFormModal({ initial, onCancel, onSave }) {
  const [category, setCategory] = useState(initial?.category || ASSUMPTION_CATEGORIES[0]);
  const [label, setLabel] = useState(initial?.label || "");
  const [value, setValue] = useState(initial?.value || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [description, setDescription] = useState(initial?.description || "");

  const handleSave = () => {
    if (!label.trim() || !value.toString().trim()) return;
    onSave({ category, label: label.trim(), value: value.toString().trim(), unit: unit.trim(), description: description.trim() });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={{ ...styles.modalCard, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{initial ? "Edit Assumption" : "Add Assumption"}</div>
          <button onClick={onCancel} style={styles.iconBtnGhost} title="Close"><X size={16} /></button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Category</div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...styles.yearSelect, width: "100%" }}>
            {ASSUMPTION_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Label<RequiredStar /></div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Interest Rate on Loans" style={{ ...styles.chatInput, background: "#FFFFFF", width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Value<RequiredStar /></div>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="10" style={{ ...styles.chatInput, background: "#FFFFFF", width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Unit</div>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="% p.a." style={{ ...styles.chatInput, background: "#FFFFFF", width: "100%" }} />
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Description</div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...styles.chatTextarea, width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.primaryBtn} disabled={!label.trim() || !value.toString().trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ---- Operational Stats -----------------------------------------------------
function OperationalStatsTab({ showToast, year }) {
  const { fmtN } = useNumberUnit();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInvoicesByYearRange(year, 2023)
      .then(byYear => { if (!cancelled) setStats(computeOperationalStats(byYear, year)); })
      .catch(e => { console.error("OperationalStatsTab load failed:", e); showToast(`Couldn't load operational stats: ${e.message}`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  if (loading) return <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading operational stats for {year} (and prior years, to compute what's new)…</div>;
  if (!stats) return null;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 14 }}>
        Computed from raw invoice-level actuals (CIPR) for {year}. "New this year" compares against every prior year synced (2023 onward) — an entity only counts as new if it's never appeared before.
      </div>

      <div style={styles.kpiGrid}>
        <KpiCard label="Invoices" value={stats.invoiceCount.toLocaleString()} />
        <KpiCard label="Vendors" value={stats.vendorCount.toLocaleString()} sub={`+${stats.newVendors} new this year`} />
        <KpiCard label="Customers" value={stats.customerCount.toLocaleString()} sub={`+${stats.newCustomers} new this year`} />
        <KpiCard label="End Customers" value={stats.endCustomerCount.toLocaleString()} sub={`+${stats.newEndCustomers} new this year`} />
        <KpiCard label="Countries" value={stats.countryCount.toLocaleString()} sub={`+${stats.newCountries} new this year`} />
        <KpiCard label="Average Deal Size" value={fmtN(stats.avgDealSize)} />
        <KpiCard label="Deals Above 20% Margin" value={stats.dealsAbove20Margin.toLocaleString()} />
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Revenue Buckets — Deal Size Distribution</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.revenueBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" fontSize={12} stroke="#6B6B6B" />
            <YAxis fontSize={12} stroke="#6B6B6B" allowDecimals={false} />
            <Tooltip formatter={(v, name) => name === "count" ? `${v} deals` : fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
              {stats.revenueBuckets.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>GP% Buckets — Margin Distribution</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.gpBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" fontSize={12} stroke="#6B6B6B" />
            <YAxis fontSize={12} stroke="#6B6B6B" allowDecimals={false} />
            <Tooltip formatter={(v, name) => name === "count" ? `${v} deals` : fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
              {stats.gpBuckets.map((_, i) => <Cell key={i} fill={DEPT_COLORS[(i + 6) % DEPT_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {stats.segments.length > 0 && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Segment-wise Revenue (ZTX Framework)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, stats.segments.length * 32)}>
            <BarChart data={stats.segments} layout="vertical" margin={{ top: 6, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" fontSize={12} stroke="#6B6B6B" tickFormatter={(v) => fmtN(v)} />
              <YAxis type="category" dataKey="name" fontSize={12} stroke="#6B6B6B" width={160} />
              <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {stats.segments.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.trend.length > 1 && (
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Multi-Year Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="year" fontSize={12} stroke="#6B6B6B" />
              <YAxis fontSize={12} stroke="#6B6B6B" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="Invoices" stroke="#C00000" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Vendors" stroke="#2A5C9A" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Customers" stroke="#1B8A3A" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="End Customers" stroke="#8A6D1A" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Countries" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---- Cash Flow module — AR (CIPR) vs AP (Bills) by due date -------------
// See Cash_Flow_Module_Requirements2.md. The chart/KPIs/ledger below are
// NOT year-scoped — a due date can fall in a different calendar year than
// the record's own source-partition year, so getCashFlowRawData always
// pulls the full multi-year window and everything here buckets strictly
// by due date, regardless of which year is selected up top. The app's
// existing top-bar Year selector is reused here for exactly one purpose:
// picking which year's Bills to sync — Bills is a brand-new source this
// module introduces, so unlike CIPR (already backfilled years ago) there's
// no historical billsActuals data yet, and each past year needs its own
// manual sync call the same way syncCipr originally did. AR refreshes via
// the existing top-bar "Sync Now" button (syncCipr already captures every
// field this module needs — see cashFlowData.js's header comment); only
// AP needs its own sync button here.
function CashFlowTab({ showToast, year }) {
  const { fmtN } = useNumberUnit();
  const [granularity, setGranularity] = useState("month");
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCashFlowRawData();
      setRaw(data);
    } catch (e) {
      console.error("CashFlowTab load failed:", e);
      showToast(`Couldn't load cash flow data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleSyncBills = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncBillsNow(year);
      await load();
      showToast(`Synced ${result.billRowsSynced} bill rows for ${result.year}. (AR refreshes with the main Sync button in the top bar.)`);
    } catch (e) {
      showToast(`Bills sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const cf = useMemo(() => {
    if (!raw) return null;
    return computeCashFlow(raw.invoices, raw.bills, granularity);
  }, [raw, granularity]);

  if (loading) return <div style={{ fontSize: 12, color: "#6B6B6B" }}>Loading cash flow data (AR from CIPR, AP from Bills)…</div>;
  if (!cf) return null;

  const { periods, currentIndex, kpis, agedAR, agedAP } = cf;
  const chartData = periods.map((p) => ({ label: p.label, AR: p.ar, AP: -p.ap, Net: p.net }));
  const currentLabel = periods[currentIndex]?.label;
  // Visual scale only — bars read relative to a 90-day reference, not a
  // hard max (an actual figure above 90 just fills the track).
  const scalePct = (days) => Math.max(4, Math.min(100, Math.round(((days || 0) / 90) * 100)));

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11.5, color: "#8A8A8A", maxWidth: 620 }}>
          AR = open Balance from CIPR invoices, bucketed by Due Date. AP = open Balance(USD) from Bills, bucketed by Due Date. Same due-date field drives every granularity below (§3.4) — paid-in-full rows (Balance = 0) are excluded from both.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.scenarioToggle}>
            {["day", "week", "month", "quarter", "year"].map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={{ ...styles.scenarioBtn, ...(granularity === g ? styles.scenarioBtnActive : {}) }}>
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
          {/* No separate year control here on purpose — this reads the
              app's existing top-bar Year selector. Change the year up top,
              then click this to sync that year's Bills. Doesn't affect
              anything else on this tab, which always shows the full
              multi-year AR/AP window regardless of which year is selected. */}
          <button onClick={handleSyncBills} disabled={syncing} style={styles.planBtn} title={`Pull Bills (AP) for ${year} from Zoho Analytics — change the year in the top bar to sync a different year. AR refreshes via the main Sync button up there.`}>
            <RefreshCw size={12} style={{ marginRight: 5, ...(syncing ? { animation: "spin 1s linear infinite" } : {}) }} />
            {syncing ? "Syncing…" : `Sync Bills ${year}`}
          </button>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <KpiCard label={`AR due — ${currentLabel}`} value={fmtN(kpis.arDue)} sub="Sum of open Balance, CIPR" />
        <KpiCard label={`AP due — ${currentLabel}`} value={fmtN(kpis.apDue)} sub="Sum of open Balance(USD), Bills" />
        <KpiCard
          label="Net position" value={`${kpis.isSurplus ? "+" : ""}${fmtN(kpis.net)}`}
          sub={kpis.isSurplus ? "Surplus" : "Deficit"} trend={kpis.isSurplus ? "up" : "down"}
        />
        <KpiCard label="Avg customer terms" value={kpis.avgCustomerTermsDays != null ? `${kpis.avgCustomerTermsDays.toFixed(0)} days` : "—"} sub="CIPR: due − invoice date" />
        <KpiCard label="DSO" value={kpis.dsoDays != null ? `${kpis.dsoDays.toFixed(0)} days` : "—"} sub="Collcted(Days), Collected invoices" />
        <KpiCard
          label="Deficit periods ahead" value={`${kpis.deficitCount} of ${kpis.consideredCount}`}
          sub={`From ${currentLabel}`} trend={kpis.deficitCount > 0 ? "down" : "up"}
        />
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>AR vs AP by Due Date</div>
        <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11.5, color: "#6B6B6B" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1B8A3A", borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />AR due (CIPR — Balance)</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#C00000", borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />AP due (Bills — Balance USD)</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#8A6D1A", borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />Net position</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="label" fontSize={11} stroke="#6B6B6B" interval={periods.length > 24 ? Math.ceil(periods.length / 24) : 0} />
            <YAxis fontSize={12} stroke="#6B6B6B" tickFormatter={(v) => fmtN(Math.abs(v))} />
            <Tooltip formatter={(v, name) => [fmtFull(Math.abs(v)), name]} contentStyle={{ background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8 }} />
            <Bar dataKey="AR" name="AR due" fill="#1B8A3A" radius={[3, 3, 0, 0]} />
            <Bar dataKey="AP" name="AP due" fill="#C00000" radius={[0, 0, 3, 3]} />
            <Line type="monotone" dataKey="Net" name="Net position" stroke="#8A6D1A" strokeWidth={2} dot={{ r: 2 }} />
            {currentLabel && <ReferenceLine x={currentLabel} stroke="#333333" strokeDasharray="3 3" label={{ value: "Current", position: "top", fontSize: 10, fill: "#6B6B6B" }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 16, marginBottom: 16, alignItems: "stretch" }}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Average Customer Terms &amp; DSO</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span>Customers (CIPR: Due Date − Invoice Date)</span>
              <span style={{ fontFamily: "monospace", color: "#6B6B6B" }}>{kpis.avgCustomerTermsDays != null ? `${kpis.avgCustomerTermsDays.toFixed(0)} days avg` : "no data"}</span>
            </div>
            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: "#1B8A3A", width: `${scalePct(kpis.avgCustomerTermsDays)}%` }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 12, borderTop: "1px solid #E0E0E0" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#C00000", fontFamily: "monospace" }}>{kpis.dsoDays != null ? `${kpis.dsoDays.toFixed(0)}d` : "—"}</div>
            <div style={{ fontSize: 12, color: "#6B6B6B", lineHeight: 1.5 }}>
              <strong style={{ color: "#333333" }}>Days Sales Outstanding</strong><br />
              Avg of Collcted(Days) across "Collected" CIPR invoices (falls back to Last Payment Date − Invoice Date if that field is blank for a row).
            </div>
          </div>
          <div style={{ marginTop: 14, padding: "9px 11px", background: "#F7F7F7", border: "1px solid #E0E0E0", borderRadius: 7, fontSize: 11.5, color: "#6B6B6B" }}>
            Vendor terms deferred this phase — Bills' Payment Terms field isn't readable yet (raw record IDs, not term text). Will be added back once fixed on the Zoho side.
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Aged Balances</div>
          <div style={{ fontSize: 11, color: "#8A8A8A", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Open &amp; overdue &gt; {AGED_THRESHOLD_DAYS} days</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span>Aged AR ({agedAR.count} invoices)</span>
              <span style={{ fontFamily: "monospace", color: "#1B8A3A" }}>{fmtFull(agedAR.total)}</span>
            </div>
            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: "#1B8A3A", width: `${Math.min(100, Math.max(4, agedAR.count ? 60 : 0))}%` }} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span>Aged AP ({agedAP.count} bills)</span>
              <span style={{ fontFamily: "monospace", color: "#C00000" }}>{fmtFull(agedAP.total)}</span>
            </div>
            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: "#C00000", width: `${Math.min(100, Math.max(4, agedAP.count ? 60 : 0))}%` }} />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#6B6B6B", paddingTop: 10, borderTop: "1px solid #E0E0E0", lineHeight: 1.5 }}>
            Items still open with a due date more than {AGED_THRESHOLD_DAYS} days in the past. Shown separately so they don't distort the current-period surplus/deficit read above — these are collection/payment issues, not upcoming cash flow.
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Period Ledger</div>
        <div style={{ fontSize: 11.5, color: "#8A8A8A", marginBottom: 10 }}>Positive = cash surplus, negative = cash deficit.</div>
        <div style={styles.tableScroll}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: "left" }}>Period</th>
                <th style={styles.th}>AR due</th>
                <th style={styles.th}>AP due</th>
                <th style={styles.th}>Net</th>
                <th style={{ ...styles.th, textAlign: "left" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.key} style={i === currentIndex ? { background: "rgba(232,183,92,0.10)" } : {}}>
                  <td style={{ ...styles.td, textAlign: "left", fontWeight: 500 }}>{p.label}{i === currentIndex ? <span style={{ color: "#8A6D1A", fontSize: 11 }}> ← current</span> : null}</td>
                  <td style={{ ...styles.td, color: "#1B8A3A" }}>{fmtN(p.ar)}</td>
                  <td style={{ ...styles.td, color: "#C00000" }}>{fmtN(p.ap)}</td>
                  <td style={{ ...styles.td, fontWeight: 600, color: p.isSurplus ? "#1B8A3A" : "#C00000" }}>{p.isSurplus ? "+" : ""}{fmtN(p.net)}</td>
                  <td style={{ ...styles.td, textAlign: "left" }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 6, background: p.isSurplus ? "#1B8A3A" : "#C00000" }} />
                    {p.isSurplus ? "Surplus" : "Deficit"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VersionsTab({ versions, onLoad, onSaveClick, activeBudgetingYear, showToast, onRefreshCurrentYear }) {
  const [baseYear, setBaseYear] = useState((activeBudgetingYear || new Date().getFullYear() + 1) - 1);
  const [growthPct, setGrowthPct] = useState(17);
  const [targetYears, setTargetYears] = useState(() => {
    const start = activeBudgetingYear || new Date().getFullYear() + 1;
    return new Set([start, start + 1, start + 2, start + 3]);
  });
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const toggleYear = (y) => setTargetYears(prev => { const next = new Set(prev); next.has(y) ? next.delete(y) : next.add(y); return next; });

  const handleGenerate = async () => {
    const years = [...targetYears].sort((a, b) => a - b);
    if (years.length === 0) { showToast("Pick at least one target year."); return; }
    if (!window.confirm(
      `Generate budgets for ${years.join(", ")} from ${baseYear}'s vendor list and monthly phasing, compounding ${growthPct}% growth each year?\n\n` +
      `This will merge into (not replace) any existing entries for ${activeBudgetingYear} if it's among the target years, and will overwrite any previously-generated placeholder data for the other years.`
    )) return;
    setGenerating(true);
    try {
      const results = await generateFutureBudgets(baseYear, years, growthPct);
      setLastResult(results);
      showToast(`Generated budgets for ${years.join(", ")} — ${results[0]?.vendorsWritten || 0} vendors each.`);
      onRefreshCurrentYear();
    } catch (e) {
      showToast(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => (activeBudgetingYear || new Date().getFullYear() + 1) + i - 1); // baseYear..+4, roughly

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Generate Future Budgets</div>
        <div style={{ fontSize: 12.5, color: "#6B6B6B", marginBottom: 14 }}>
          Projects a base year's vendor list and monthly budget phasing forward across future years, compounding a growth% each year — so management has a real starting point instead of a blank sheet. The active budgeting year ({activeBudgetingYear}) is written into the actual editable budget and merged with anything already entered; other years are written as read-only placeholder budgets (same collection real Zoho syncs use — a real sync later naturally replaces the placeholder).
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Base year</div>
            <input type="number" value={baseYear} onChange={(e) => setBaseYear(parseInt(e.target.value, 10) || baseYear)} style={{ ...styles.chatInput, background: "#FFFFFF", width: 100 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Growth % per year</div>
            <input type="number" value={growthPct} onChange={(e) => setGrowthPct(parseFloat(e.target.value) || 0)} style={{ ...styles.chatInput, background: "#FFFFFF", width: 100 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 3 }}>Target years</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {yearOptions.filter(y => y !== baseYear).map(y => (
                <label key={y} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
                  <input type="checkbox" checked={targetYears.has(y)} onChange={() => toggleYear(y)} />
                  {y}{y === activeBudgetingYear ? " (active)" : ""}
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating} style={styles.primaryBtn}>{generating ? "Generating…" : "Generate"}</button>
        </div>
        {lastResult && (
          <div style={{ fontSize: 11.5, color: "#6B6B6B" }}>
            {lastResult.map(r => <div key={r.year}>{r.year}: {r.vendorsWritten} vendors{r.regionsWritten != null ? `, ${r.regionsWritten} regions` : ""} → {r.target}</div>)}
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Saved Budget Versions</div>
        <div style={{ fontSize: 12.5, color: "#6B6B6B", marginBottom: 14 }}>Versions are shared across everyone using this tool. Save a snapshot before making major edits so it can be recalled later.</div>
        {versions.length === 0 ? (
          <div style={styles.emptyState}><div style={{ fontSize: 14, marginBottom: 10 }}>No versions saved yet.</div><button onClick={onSaveClick} style={styles.primaryBtn}><Save size={14} style={{ marginRight: 6 }} />Save current state</button></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {versions.map(v => (
              <div key={v.id} style={styles.versionRow}>
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div><div style={{ fontSize: 11.5, color: "#6B6B6B", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><Clock size={11} /> {new Date(v.created_at).toLocaleString()}</div></div>
                <button onClick={() => onLoad(v.id)} style={styles.secondaryBtn}>Load</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ messages, input, setInput, onSend, onStop, loading, pendingDiff, onConfirm, onCancel, chatEndRef, onClose, width, onStartResize, minimized, onToggleMinimize, maximized, onToggleMaximize, onEditMessage, onNewChat }) {
  const { unit } = useNumberUnit();
  return (
    <aside style={{ ...styles.chatPanel, width, position: "relative", height: "100%" }}>
      {/* Drag handle — grab the left edge to resize. Full-height, thin
          hit-target; only active (col-resize cursor) when not minimized,
          since there's nothing to drag from a collapsed strip. */}
      {!minimized && (
        <div
          onMouseDown={onStartResize}
          style={{ position: "absolute", left: -3, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 5 }}
          title="Drag to resize"
        />
      )}

      {minimized ? (
        // Collapsed strip — just enough to reopen; full chat body/input
        // hidden since there's no room to use them at this width.
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 10, height: "100%" }}>
          <button onClick={onToggleMinimize} style={styles.iconBtnGhost} title="Restore chat"><ChevronLeft size={16} /></button>
          <Sparkles size={15} color="#C00000" />
        </div>
      ) : (
        <>
          <div style={{ ...styles.chatHeader, flexWrap: "nowrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Sparkles size={15} color="#C00000" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.2, whiteSpace: "nowrap" }}>Sir Slice-a-Lot</div>
                <div style={{ fontSize: 10, color: "#8A8A8A", lineHeight: 1.2, whiteSpace: "nowrap" }}>Slice. Interpret. Report.</div>
              </div>
            </div>
            {/* No M/K/Full toggle here — it lives once in the top bar and
                controls everything, including this chat, via shared context. */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => { if (messages.length > 1 && !window.confirm("Start a new chat? This clears the current conversation.")) return; onNewChat(); }}
                style={{ ...styles.iconBtnGhost, fontSize: 16, fontWeight: 600, lineHeight: 1 }} title="New chat — clears the conversation (also keeps token usage down on long threads)"
              >
                +
              </button>
              <button onClick={onToggleMinimize} style={styles.iconBtnGhost} title="Minimize"><Minus size={14} /></button>
              <button onClick={onToggleMaximize} style={styles.iconBtnGhost} title={maximized ? "Restore size" : "Maximize"}>
                {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button onClick={onClose} style={styles.iconBtnGhost} title="Close"><X size={15} /></button>
            </div>
          </div>
          <div style={styles.chatBody}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "chat-msg-user" : undefined} style={{ ...styles.chatBubbleWrap, justifyContent: m.role === "user" ? "flex-end" : "flex-start", position: "relative" }}>
                {m.role === "user" && onEditMessage && (
                  <button
                    onClick={() => onEditMessage(i)}
                    className="chat-edit-btn"
                    style={{ ...styles.iconBtnGhost, width: 22, height: 22, alignSelf: "center", opacity: 0, transition: "opacity .12s" }}
                    title="Edit and resubmit"
                  >
                    <Sliders size={11} />
                  </button>
                )}
                {m.type === "diff" && pendingDiff ? (<DiffCard diff={pendingDiff} onConfirm={onConfirm} onCancel={onCancel} />) :
                  m.type === "table" ? (<TableMessage table={m.table} text={m.text} numberUnit={unit} />) :
                  (<div style={{ ...styles.chatBubble, ...(m.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant) }}>{reformatNumbersInText(m.text, unit)}</div>)}
              </div>
            ))}
            {loading && (<div style={styles.chatBubbleWrap}><div style={{ ...styles.chatBubble, ...styles.chatBubbleAssistant, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> thinking…</div></div>)}
            <div ref={chatEndRef} />
          </div>
          <div style={{ ...styles.chatInputRow, alignItems: "flex-end" }}>
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="e.g. set Crowdstrike to 40M (Shift+Enter for a new line)"
              rows={3}
              style={styles.chatTextarea}
            />
            {loading ? (
              <button onClick={onStop} style={{ ...styles.chatSendBtn, background: "#6B6B6B" }} title="Stop"><X size={15} /></button>
            ) : (
              <button onClick={onSend} style={styles.chatSendBtn} disabled={!input.trim()}><Send size={15} /></button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

// Infers a column's number type from its header text, since the model
// gives no other signal — a column literally called "Invoice Count" or
// "Variance %" should never get $ formatting, only real currency columns
// (Revenue, GP, Budget, Amount, etc.) should.
function getColumnFormatType(header) {
  const h = String(header || "").toLowerCase();
  if (h.includes("%")) return "percent";
  if (h.includes("count") || h === "invoices" || h === "qty" || h === "quantity") return "count";
  return "currency";
}
// Chart Y-axis width needs to scale with the number format — "Full" mode
// numbers ($27,653,566) are far longer than "M" mode ones ($27.65M) and
// were getting clipped against a fixed width tuned only for millions.
// Finds large numbers embedded in prose (the model is instructed to write
// raw unformatted numbers even in sentences, same as table cells) and
// reformats them per the current M/K/Full unit — extends that formatting
// beyond table cells into chat message text, so "revenue is 27701202"
// renders as "$27.70M" consistently with the rest of the app.
function reformatNumbersInText(text, unit) {
  if (!text) return text;
  return text.replace(/\$?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?-?\d{4,}(?:\.\d+)?/g, (match) => {
    const hadDollar = match.includes("$");
    const numStr = match.replace(/[$,]/g, "");
    const num = Number(numStr);
    if (isNaN(num)) return match;
    // A bare 4-digit number with no comma/decimal/$ that looks like a
    // calendar year (1900-2099) is almost certainly a year reference
    // ("in 2026"), not a dollar figure — leave it alone.
    if (!hadDollar && !match.includes(",") && !match.includes(".") && num >= 1900 && num <= 2099) return match;
    return fmtByUnit(num, unit);
  });
}

function yAxisWidthForUnit(unit) {
  if (unit === "full") return 92;
  if (unit === "thousands") return 76;
  return 64; // millions
}

function formatTableCell(value, header, numberUnit) {
  if (typeof value !== "number") return value;
  const type = getColumnFormatType(header);
  if (type === "percent") return `${value.toFixed(1)}%`;
  if (type === "count") return value.toLocaleString("en-US");
  return fmtByUnit(value, numberUnit);
}

function TableMessage({ table, text, numberUnit }) {
  const columns = table?.columns || [];
  const rows = table?.rows || [];
  // Auto-totals: sum every column that's fully numeric across all rows,
  // except percent/count columns — summing a % column isn't meaningful,
  // and a "totaled" invoice count across a breakdown is often misleading
  // too (double-counts rows that could belong to multiple groups), so
  // both are skipped the same way. Skipped entirely for single-row
  // tables, where a totals row would just repeat the one row.
  const totals = rows.length > 1 ? columns.map((c, ci) => {
    if (ci === 0) return "Total";
    if (getColumnFormatType(c) !== "currency") return null;
    const allNumeric = rows.every(r => typeof r[ci] === "number");
    return allNumeric ? rows.reduce((s, r) => s + (r[ci] || 0), 0) : null;
  }) : null;
  const showTotals = totals && totals.some((t, ci) => ci > 0 && t !== null);

  return (
    <div style={{ ...styles.chatBubble, ...styles.chatBubbleAssistant, width: "100%", maxWidth: "100%", padding: 12 }}>
      {table?.title && <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>{table.title}</div>}
      <div style={styles.tableScroll}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "3px 7px", borderBottom: "1px solid #E0E0E0", color: "#6B6B6B", fontWeight: 600, whiteSpace: "nowrap" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={ci > 0 ? "num" : undefined} style={{ textAlign: ci === 0 ? "left" : "right", padding: "3px 7px", borderBottom: "1px solid #F0F0F0", whiteSpace: "nowrap" }}>
                    {formatTableCell(cell, columns[ci], numberUnit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {showTotals && (
            <tfoot>
              <tr style={{ borderTop: "2px solid #111111" }}>
                {totals.map((t, ci) => (
                  <td key={ci} className={ci > 0 ? "num" : undefined} style={{ textAlign: ci === 0 ? "left" : "right", padding: "3px 7px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {t === null ? "" : (ci === 0 ? t : formatTableCell(t, columns[ci], numberUnit))}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {text && <div style={{ marginTop: 9, fontSize: 12.5 }}>{reformatNumbersInText(text, numberUnit)}</div>}
    </div>
  );
}

function DiffCard({ diff, onConfirm, onCancel }) {
  const { fmtN, unit } = useNumberUnit();
  const revUp = diff.newRevenue >= diff.oldRevenue;
  return (
    <div style={styles.diffCard}>
      <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Proposed change · {diff.vendor}</div>
      {diff.explanation && <div style={{ fontSize: 12.5, color: "#333333", marginBottom: 10 }}>{reformatNumbersInText(diff.explanation, unit)}</div>}
      <div className="num" style={styles.diffLine}><span style={styles.diffOld}>{fmtN(diff.oldRevenue)}</span><span style={{ margin: "0 8px", color: "#6B6B6B" }}>→</span><span style={{ color: revUp ? "#1B8A3A" : "#C00000", fontWeight: 600 }}>{fmtN(diff.newRevenue)}</span><span style={{ marginLeft: 8, fontSize: 11, color: "#6B6B6B" }}>revenue</span></div>
      <div className="num" style={{ ...styles.diffLine, marginTop: 4 }}><span style={styles.diffOld}>{fmtN(diff.oldGp)}</span><span style={{ margin: "0 8px", color: "#6B6B6B" }}>→</span><span style={{ color: "#333333", fontWeight: 600 }}>{fmtN(diff.newGp)}</span><span style={{ marginLeft: 8, fontSize: 11, color: "#6B6B6B" }}>GP (auto-scaled)</span></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onConfirm} style={styles.diffConfirmBtn}><Check size={13} style={{ marginRight: 4 }} />Apply</button>
        <button onClick={onCancel} style={styles.diffCancelBtn}><X size={13} style={{ marginRight: 4 }} />Discard</button>
      </div>
    </div>
  );
}

function SaveModal({ versionName, setVersionName, onCancel, onSave }) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Save budget version</div>
          <button onClick={onCancel} style={styles.iconBtnGhost} title="Close"><X size={16} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: "#6B6B6B", marginBottom: 14 }}>Visible to everyone using this tool.</div>
        <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. Q3 Board Review" style={styles.modalInput} onKeyDown={(e) => { if (e.key === "Enter") onSave(); }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
          <button onClick={onSave} style={styles.primaryBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= VENDOR PLANNER MODAL ============================= */

function VendorHistoryPanel({ history, loading }) {
  const { fmtN } = useNumberUnit();
  if (loading) return <div style={{ padding: "10px 0", fontSize: 12.5, color: "#6B6B6B" }}>Loading vendor history…</div>;
  if (!history) return null;
  const { years, tier, buHead } = history;
  const hasAnyData = years.some(y => y.budget_revenue || y.actual_revenue);

  return (
    <div style={{ background: "#F7F7F5", border: "1px solid #E0E0E0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 18, marginBottom: 12, fontSize: 12.5 }}>
        <div><span style={{ color: "#6B6B6B" }}>Tier: </span><strong>{tier || "—"}</strong></div>
        <div><span style={{ color: "#6B6B6B" }}>BU Head: </span><strong>{buHead || "—"}</strong></div>
      </div>

      {!hasAnyData ? (
        <div style={{ fontSize: 12, color: "#6B6B6B" }}>No prior-year history found for this vendor — likely a new vendor.</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={styles.historyTh}>Year</th>
                <th style={{ ...styles.historyTh, textAlign: "right" }}>Budget Rev</th>
                <th style={{ ...styles.historyTh, textAlign: "right" }}>Actual Rev</th>
                <th style={{ ...styles.historyTh, textAlign: "right" }}>% Achievement</th>
              </tr>
            </thead>
            <tbody>
              {years.map(y => (
                <tr key={y.year}>
                  <td style={styles.historyTd}>{y.year}</td>
                  <td className="num" style={{ ...styles.historyTd, textAlign: "right" }}>{fmtN(y.budget_revenue)}</td>
                  <td className="num" style={{ ...styles.historyTd, textAlign: "right" }}>{fmtN(y.actual_revenue)}</td>
                  <td className="num" style={{ ...styles.historyTd, textAlign: "right", color: y.achievement_pct === null ? "#6B6B6B" : (y.achievement_pct >= 1 ? "#1B8A3A" : "#C00000") }}>
                    {y.achievement_pct === null ? "—" : fmtPct(y.achievement_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </>
      )}
    </div>
  );
}

function VendorPlannerModal({ vendor, onClose, onApply, callClaude, year }) {
  const { fmtN } = useNumberUnit();
  const [fyRevenue, setFyRevenue] = useState(String(Math.round(vendor.budget_revenue)));
  const [gpPct, setGpPct] = useState(String((vendor.gp_pct * 100).toFixed(1)));
  const [candidates] = useState(() => buildVendorCandidates(vendor));
  const [selectedKey, setSelectedKey] = useState(candidates.find(c => c.recommended)?.key || candidates[0]?.key);
  const [customCellsPct, setCustomCellsPct] = useState(null); // overrides selected candidate once user edits
  const [mode, setMode] = useState("pick"); // "pick" | "custom" | "buhead"
  const [assistInput, setAssistInput] = useState("");
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistLog, setAssistLog] = useState([]);

  // Item 4 — last-3-years performance + region/month linearity, so
  // management sees real history before setting next year's number.
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    getVendorHistory(vendor.vendor, year)
      .then(h => { if (!cancelled) setHistory(h); })
      .catch(() => { if (!cancelled) setHistory(null); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [vendor.vendor, year]);

  const revenueNum = parseFloat(fyRevenue.replace(/[^0-9.]/g, "")) || 0;
  const gpPctNum = (parseFloat(gpPct) || 0) / 100;

  // "BU Head Update" — manual entry mode. The BU head supplies two simple 1-D
  // distributions (region % of year, month % of year) instead of a full
  // month×country grid; the grid is derived by crossing them (cell =
  // monthPct × regionPct), same independence assumption the historical
  // candidates don't need (they have real 2-D data) but a manual estimate
  // reasonably can. Seeded from the Blended candidate as a starting point
  // so the BU head is adjusting real numbers, not typing from scratch.
  const blendedCandidate = candidates.find(c => c.key === "blended") || candidates[candidates.length - 1];
  const [buHeadMonthPct, setBuHeadMonthPct] = useState(() => {
    const mp = blendedCandidate ? monthMarginal(blendedCandidate.cellsPct) : {};
    return Object.fromEntries(MONTHS.map((_, i) => [i + 1, mp[i + 1] ? (mp[i + 1] * 100).toFixed(1) : ""]));
  });
  const [buHeadRegionPct, setBuHeadRegionPct] = useState(() => {
    const cp = blendedCandidate ? countryMarginal(blendedCandidate.cellsPct) : {};
    return Object.fromEntries(Object.entries(cp).map(([c, p]) => [c, (p * 100).toFixed(1)]));
  });
  const [newRegionName, setNewRegionName] = useState("");
  const buHeadMonthSum = Object.values(buHeadMonthPct).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const buHeadRegionSum = Object.values(buHeadRegionPct).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const buHeadCellsPct = useMemo(() => {
    const monthTotal = buHeadMonthSum || 1; // normalize even if not exactly 100 — sum indicator flags the mismatch, doesn't block preview
    const regionTotal = buHeadRegionSum || 1;
    const cells = {};
    for (const m in buHeadMonthPct) {
      const mp = (parseFloat(buHeadMonthPct[m]) || 0) / monthTotal;
      for (const c in buHeadRegionPct) {
        const cp = (parseFloat(buHeadRegionPct[c]) || 0) / regionTotal;
        cells[`${m}|${c}`] = mp * cp;
      }
    }
    return cells;
  }, [buHeadMonthPct, buHeadRegionPct, buHeadMonthSum, buHeadRegionSum]);
  const updateRegionPct = (region, val) => setBuHeadRegionPct(prev => ({ ...prev, [region]: val }));
  const removeRegionRow = (region) => setBuHeadRegionPct(prev => { const n = { ...prev }; delete n[region]; return n; });
  const addRegionRow = () => {
    const name = newRegionName.trim();
    if (!name || buHeadRegionPct[name] !== undefined) return;
    setBuHeadRegionPct(prev => ({ ...prev, [name]: "0" }));
    setNewRegionName("");
  };

  const activeCellsPct = mode === "buhead" ? buHeadCellsPct : (customCellsPct || (candidates.find(c => c.key === selectedKey)?.cellsPct) || {});
  const grid = useMemo(() => gridFromPct(activeCellsPct, revenueNum), [activeCellsPct, revenueNum]);
  const countryTotals = useMemo(() => {
    const out = {};
    for (const m in grid) for (const c in grid[m]) out[c] = (out[c] || 0) + grid[m][c];
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }, [grid]);
  const monthTotals = useMemo(() => MONTHS.map((_, i) => {
    const m = i + 1;
    return grid[m] ? Object.values(grid[m]).reduce((a, b) => a + b, 0) : 0;
  }), [grid]);

  const countryList = useMemo(() => countryTotals.map(([c]) => c), [countryTotals]);
  const maxCell = useMemo(() => {
    let mx = 1;
    for (const m in grid) for (const c in grid[m]) mx = Math.max(mx, grid[m][c]);
    return mx;
  }, [grid]);

  // Same invariant FullGrid checks (grid total should always equal
  // revenueNum, by construction of gridFromPct + the normalized cellsPct
  // sources) — gating Apply here too so a mismatch can't be silently
  // applied, not just passively warned about.
  const gridGrandTotal = countryTotals.reduce((s, [, v]) => s + v, 0);
  const gridMismatch = Math.abs(gridGrandTotal - revenueNum) > Math.max(1, revenueNum * 0.001);

  const selectCandidate = (key) => { setSelectedKey(key); setCustomCellsPct(null); setMode("pick"); };

  const editCell = (month, country, value) => {
    const num = parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
    const base = customCellsPct ? { ...customCellsPct } : { ...activeCellsPct };
    const currentTotal = revenueNum || 1;
    const newGrid = gridFromPct(base, currentTotal);
    if (!newGrid[month]) newGrid[month] = {};
    newGrid[month][country] = num;
    const { cellsPct, total } = gridToCellsPct(newGrid);
    setCustomCellsPct(cellsPct);
    setFyRevenue(String(Math.round(total)));
    setMode("custom");
  };

  const runAssistant = async () => {
    const text = assistInput.trim();
    if (!text || assistLoading) return;
    setAssistLog(l => [...l, { role: "user", text }]);
    setAssistInput("");
    setAssistLoading(true);
    try {
      const countrySummary = countryTotals.map(([c, v]) => `${c}: ${fmtPct1(v / revenueNum)}`).join(", ");
      const parsed = await callClaude(text, "grid_adjust", { vendor: vendor.vendor, countrySummary, countryList });
      if (parsed.type === "adjust" && Array.isArray(parsed.changes) && parsed.changes.length) {
        const oldCountryPct = {};
        for (const [c, v] of countryTotals) oldCountryPct[c] = v / revenueNum;
        const changedSet = new Set(parsed.changes.map(c => c.country));
        let mentionedOldSum = 0, mentionedNewSum = 0;
        for (const ch of parsed.changes) { mentionedOldSum += oldCountryPct[ch.country] || 0; mentionedNewSum += ch.new_pct; }
        const oldRemainingPool = 1 - mentionedOldSum;
        const newRemainingPool = 1 - mentionedNewSum;
        const scaleFactor = { };
        for (const ch of parsed.changes) {
          const oldP = oldCountryPct[ch.country] || 0.0001;
          scaleFactor[ch.country] = ch.new_pct / oldP;
        }
        for (const c of countryList) {
          if (!changedSet.has(c)) scaleFactor[c] = oldRemainingPool > 0 ? newRemainingPool / oldRemainingPool : 1;
        }
        const base = customCellsPct || activeCellsPct;
        const newCells = {};
        for (const k in base) {
          const c = k.split("|")[1];
          const f = scaleFactor[c] !== undefined ? scaleFactor[c] : 1;
          newCells[k] = base[k] * f;
        }
        const s = Object.values(newCells).reduce((a, b) => a + b, 0) || 1;
        for (const k in newCells) newCells[k] = newCells[k] / s;
        setCustomCellsPct(newCells);
        setMode("custom");
        setAssistLog(l => [...l, { role: "assistant", text: parsed.message || "Adjusted." }]);
      } else {
        setAssistLog(l => [...l, { role: "assistant", text: parsed.message || "Not sure how to apply that — try naming a country and a target %." }]);
      }
    } catch (e) {
      setAssistLog(l => [...l, { role: "assistant", text: "Couldn't reach the assistant — try again." }]);
    } finally { setAssistLoading(false); }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.plannerCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.plannerHeader}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>Plan FY Budget — {vendor.vendor}</div>
            <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 2 }}>Set the annual number once; the system derives the month × country split.</div>
          </div>
          <button onClick={onClose} style={styles.iconBtnGhost}><X size={16} /></button>
        </div>

        <VendorHistoryPanel history={history} loading={historyLoading} />

        <div style={styles.plannerInputsRow}>
          <div style={styles.plannerInputGroup}>
            <label style={styles.plannerLabel}>FY Revenue</label>
            <input className="num" value={fyRevenue} onChange={(e) => { setFyRevenue(e.target.value); setCustomCellsPct(c => c); }} style={styles.plannerInput} />
          </div>
          <div style={styles.plannerInputGroup}>
            <label style={styles.plannerLabel}>GP%</label>
            <input className="num" value={gpPct} onChange={(e) => setGpPct(e.target.value)} style={styles.plannerInput} />
          </div>
          <div style={{ ...styles.plannerInputGroup, flex: 1 }}>
            <label style={styles.plannerLabel}>Implied GP</label>
            <div className="num" style={{ ...styles.plannerInput, background: "transparent", border: "1px dashed #E0E0E0", color: "#6B6B6B" }}>{fmtN(revenueNum * gpPctNum)}</div>
          </div>
        </div>

        <div style={styles.plannerBody}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 0 8px" }}>Choose a linearity source</div>
          <div style={styles.candidateGrid}>
            {candidates.map(c => (
              <CandidateCard key={c.key} candidate={c} selected={mode === "pick" && selectedKey === c.key} onSelect={() => selectCandidate(c.key)} />
            ))}
            <div onClick={() => setMode("buhead")} style={{ ...styles.candidateCard, ...(mode === "buhead" ? styles.candidateCardSelected : {}), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Terminal size={18} color="#111111" />
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>BU Head Update</div>
              <div style={{ fontSize: 10.5, color: "#6B6B6B", marginTop: 2, textAlign: "center" }}>Manually enter region % and month %</div>
            </div>
            <div onClick={() => setMode("custom")} style={{ ...styles.candidateCard, ...(mode === "custom" ? styles.candidateCardSelected : {}), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Wand2 size={18} color="#111111" />
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>Custom</div>
              <div style={{ fontSize: 10.5, color: "#6B6B6B", marginTop: 2, textAlign: "center" }}>Edit cells directly or ask the assistant</div>
            </div>
          </div>

          {mode === "buhead" && (
            <div style={{ ...styles.assistBox, marginTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 10 }}>
                Enter the BU head's estimated split — each column should sum to 100%. The grid preview below updates live.
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 4 }}>
                    <span>MONTH %</span>
                    <span style={{ color: Math.abs(buHeadMonthSum - 100) < 0.5 ? "#1B8A3A" : "#C00000" }}>{buHeadMonthSum.toFixed(1)}%</span>
                  </div>
                  {MONTHS.map((mn, i) => (
                    <div key={mn} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, width: 30 }}>{mn}</span>
                      <input className="num" value={buHeadMonthPct[i + 1]} onChange={(e) => setBuHeadMonthPct(prev => ({ ...prev, [i + 1]: e.target.value }))} style={{ ...styles.gridCellInput, width: 56, position: "static" }} placeholder="0" />
                    </div>
                  ))}
                </div>
                <div style={{ minWidth: 180 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 4 }}>
                    <span>REGION %</span>
                    <span style={{ color: Math.abs(buHeadRegionSum - 100) < 0.5 ? "#1B8A3A" : "#C00000" }}>{buHeadRegionSum.toFixed(1)}%</span>
                  </div>
                  {Object.keys(buHeadRegionPct).map(region => (
                    <div key={region} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{region}</span>
                      <input className="num" value={buHeadRegionPct[region]} onChange={(e) => updateRegionPct(region, e.target.value)} style={{ ...styles.gridCellInput, width: 56, position: "static" }} placeholder="0" />
                      <button onClick={() => removeRegionRow(region)} style={{ ...styles.iconBtnGhost, width: 20, height: 20 }} title={`Remove ${region}`}><X size={11} /></button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input value={newRegionName} onChange={(e) => setNewRegionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRegionRow(); }} placeholder="Add region…" style={{ ...styles.chatInput, background: "#FFFFFF", fontSize: 11.5, padding: "5px 8px" }} />
                    <button onClick={addRegionRow} style={styles.secondaryBtn}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 8px" }}>
            <Grid3x3 size={14} color="#6B6B6B" />
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {mode === "custom" ? "Custom grid — click any cell to edit" : "Applied grid preview"}
            </div>
          </div>
          <FullGrid grid={grid} countryList={countryList} maxCell={maxCell} editable={mode === "custom"} onEditCell={editCell} targetRevenue={revenueNum} />

          {mode === "custom" && (
            <div style={styles.assistBox}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} color="#C00000" /> Ask the assistant to rebalance</div>
              {assistLog.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, maxHeight: 100, overflowY: "auto" }}>
                  {assistLog.map((m, i) => (<div key={i} style={{ fontSize: 12, color: m.role === "user" ? "#111111" : "#C00000" }}>{m.role === "user" ? "→ " : "✓ "}{m.text}</div>))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={assistInput} onChange={(e) => setAssistInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runAssistant(); }} placeholder='e.g. "give UAE 5 points more, take it from KSA"' style={{ ...styles.chatInput, background: "#FFFFFF" }} />
                <button onClick={runAssistant} style={styles.chatSendBtn} disabled={assistLoading}>{assistLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}</button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.plannerFooter}>
          <div style={{ fontSize: 12, color: "#6B6B6B" }}>Total: <span className="num" style={{ color: "#111111", fontWeight: 600 }}>{fmtN(revenueNum)}</span> · GP: <span className="num" style={{ color: "#111111", fontWeight: 600 }}>{fmtN(revenueNum * gpPctNum)}</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={styles.secondaryBtn}>Cancel</button>
            <button onClick={() => onApply(grid, gpPctNum)} style={{ ...styles.primaryBtn, ...(gridMismatch ? { opacity: 0.4, cursor: "not-allowed" } : {}) }} disabled={gridMismatch} title={gridMismatch ? "Grid total doesn't match FY Revenue — see the warning above the grid" : undefined}><Check size={14} style={{ marginRight: 6 }} />Apply to Budget</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ candidate, selected, onSelect }) {
  const countryPct = countryMarginal(candidate.cellsPct);
  const monthPct = monthMarginal(candidate.cellsPct);
  const regionRows = Object.entries(countryPct).sort((a, b) => b[1] - a[1]);
  return (
    <div onClick={onSelect} style={{ ...styles.candidateCard, ...(selected ? styles.candidateCardSelected : {}), cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{candidate.label}</div>
        {selected && <Check size={13} color="#C00000" />}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 3 }}>REGION %</div>
          {regionRows.map(([c, p]) => (
            <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, padding: "1px 0" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
              <span className="num" style={{ flexShrink: 0, marginLeft: 6 }}>{fmtPct1(p)}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: "#6B6B6B", marginBottom: 3 }}>MONTH %</div>
          {MONTHS.map((mn, i) => (
            <div key={mn} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, padding: "1px 0" }}>
              <span>{mn}</span>
              <span className="num">{fmtPct1(monthPct[i + 1] || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FullGrid({ grid, countryList, maxCell, editable, onEditCell, compact, targetRevenue }) {
  const { fmtN } = useNumberUnit();
  const [editing, setEditing] = useState(null); // "m|c"
  const [editVal, setEditVal] = useState("");
  const cellSize = compact ? 46 : 68;

  const rowTotals = MONTHS.map((_, i) => {
    const m = i + 1;
    return grid[m] ? countryList.reduce((s, c) => s + (grid[m][c] || 0), 0) : 0;
  });
  const colTotals = countryList.map(c => {
    let s = 0;
    for (const m in grid) s += grid[m][c] || 0;
    return s;
  });
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
  // Structurally this should always match (grids are built from cellsPct
  // that's normalized to sum to 1, and every edit path recomputes/resyncs
  // fyRevenue to the new total) — this is a safety net for that
  // invariant, not an expected everyday warning. Tolerance covers floating
  // point rounding, not real discrepancies.
  const tolerance = Math.max(1, (targetRevenue || 0) * 0.001);
  const mismatch = targetRevenue !== undefined && Math.abs(grandTotal - targetRevenue) > tolerance;

  return (
    <div>
      <div style={{ overflowX: "auto", border: "1px solid #E0E0E0", borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: compact ? 10 : 11.5 }}>
          <thead>
            <tr>
              <th style={{ ...styles.gridHeadCell, textAlign: "left", position: "sticky", left: 0, background: "#FFFFFF", zIndex: 1 }}>Month</th>
              {countryList.map(c => <th key={c} style={{ ...styles.gridHeadCell, minWidth: cellSize + 20 }}>{c}</th>)}
              <th style={{ ...styles.gridHeadCell, minWidth: cellSize + 20, fontWeight: 700, borderLeft: "2px solid #E0E0E0" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((mn, i) => {
              const m = i + 1;
              return (
                <tr key={m}>
                  <td style={{ ...styles.gridRowLabel, position: "sticky", left: 0, background: "#FFFFFF" }}>{mn}</td>
                  {countryList.map(c => {
                    const v = (grid[m] && grid[m][c]) || 0;
                    const intensity = Math.min(1, v / maxCell);
                    const key = `${m}|${c}`;
                    const isEditing = editing === key;
                    return (
                      <td key={c} style={{ ...styles.gridCell, background: `rgba(192,0,0,${0.06 + intensity * 0.28})` }}
                        onClick={() => { if (editable) { setEditing(key); setEditVal(String(Math.round(v))); } }}>
                        {isEditing ? (
                          <input autoFocus className="num" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => { onEditCell(m, c, editVal); setEditing(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { onEditCell(m, c, editVal); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
                            style={styles.gridCellInput} />
                        ) : (<span className="num">{v >= 1000 ? fmtN(v) : v > 0 ? `$${Math.round(v)}` : "—"}</span>)}
                      </td>
                    );
                  })}
                  <td className="num" style={{ ...styles.gridCell, fontWeight: 700, borderLeft: "2px solid #E0E0E0", background: "#F7F7F5" }}>
                    {rowTotals[i] > 0 ? fmtN(rowTotals[i]) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111111" }}>
              <td style={{ ...styles.gridRowLabel, position: "sticky", left: 0, background: "#FFFFFF", fontWeight: 700 }}>Total</td>
              {colTotals.map((t, i) => (
                <td key={countryList[i]} className="num" style={{ ...styles.gridCell, fontWeight: 700, background: "#F7F7F5" }}>{t > 0 ? fmtN(t) : "—"}</td>
              ))}
              <td className="num" style={{ ...styles.gridCell, fontWeight: 700, borderLeft: "2px solid #E0E0E0", background: "#EDEDED" }}>{fmtN(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {mismatch && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#C00000", background: "#FFF0F0", border: "1px solid #F0C0C0", borderRadius: 6, padding: "6px 10px" }}>
          ⚠ Grid total ({fmtN(grandTotal)}) doesn't match the FY Revenue field ({fmtN(targetRevenue)}) — off by {fmtN(Math.abs(grandTotal - targetRevenue))}. This shouldn't normally happen; check for a rounding issue before applying.
        </div>
      )}
    </div>
  );
}

/* ============================= STYLES ============================= */
const styles = {
  appRoot: { fontFamily: "'Inter', sans-serif", background: "#FFFFFF", color: "#111111", height: "100vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderBottom: "1px solid #E0E0E0", background: "#FFFFFF" },
  yearRow: { padding: "10px 24px", borderBottom: "1px solid #E0E0E0", background: "#FFFFFF" },
  logoMark: { width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #C00000, #7A0000)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 14, color: "#FFFFFF" },
  brandTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, lineHeight: 1.1 },
  brandSub: { fontSize: 11.5, color: "#6B6B6B", marginTop: 2 },
  scenarioToggle: { display: "flex", background: "#FFFFFF", borderRadius: 8, padding: 3, border: "1px solid #E0E0E0" },
  scenarioBtn: { border: "none", background: "transparent", color: "#6B6B6B", fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer" },
  yearSelect: { border: "1px solid #E0E0E0", borderRadius: 7, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, color: "#111111", background: "#FFFFFF", cursor: "pointer" },
  unitToggle: { display: "flex", border: "1px solid #E0E0E0", borderRadius: 6, overflow: "hidden" },
  unitToggleBtn: { border: "none", background: "#FFFFFF", color: "#6B6B6B", fontSize: 10.5, fontWeight: 600, padding: "3px 8px", cursor: "pointer" },
  unitToggleBtnActive: { background: "#111111", color: "#FFFFFF" },
  scenarioBtnActive: { background: "#C00000", color: "#FFFFFF" },
  primaryBtn: { display: "flex", alignItems: "center", background: "#C00000", color: "#FFFFFF", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { background: "#F4F4F4", color: "#111111", border: "1px solid #E0E0E0", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  iconBtnGhost: { background: "transparent", border: "1px solid #E0E0E0", color: "#6B6B6B", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  body: { display: "flex", alignItems: "stretch", flex: 1, minHeight: 0, overflow: "hidden" },
  sidebar: { width: 190, flexShrink: 0, borderRight: "1px solid #E0E0E0", padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4, background: "#FFFFFF" },
  navItem: { display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "transparent", border: "none", color: "#6B6B6B", fontSize: 13.5, fontWeight: 500, padding: "9px 12px", borderRadius: 8, cursor: "pointer" },
  // Blush Red — chosen 2026-08-24 from a set of six light-background
  // options. Bold weight + a solid fill (not just a tint on hover) so the
  // active tab reads unmistakably, even at a glance; boxShadow (not
  // border-left) draws the accent bar so it doesn't shift the row's padding.
  navItemActive: { background: "#F8E3E1", color: "#151414", fontWeight: 700, boxShadow: "inset 3px 0 0 0 #B4231E" },
  sidebarFootnote: { marginTop: "auto", fontSize: 10.5, color: "#8A8A8A", lineHeight: 1.5, padding: "12px" },
  main: { flex: 1, padding: "22px 24px", overflowY: "auto", minWidth: 0 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 18 },
  kpiCard: { background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  kpiLabel: { fontSize: 11.5, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" },
  kpiValue: { fontSize: 24, fontWeight: 600, marginTop: 6, fontFamily: "'Fraunces', serif" },
  kpiSub: { fontSize: 12, marginTop: 6, fontWeight: 500 },
  panel: { background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 12, padding: "18px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  panelTitle: { fontSize: 14, fontWeight: 600, marginBottom: 14, fontFamily: "'Fraunces', serif" },
  panelIconBtn: { border: "1px solid #E0E0E0", background: "#FFFFFF", borderRadius: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6B6B", cursor: "pointer" },
  historyTh: { textAlign: "left", padding: "4px 8px", borderBottom: "1px solid #E0E0E0", color: "#6B6B6B", fontWeight: 600, fontSize: 11 },
  historyTd: { padding: "4px 8px", borderBottom: "1px solid #EDEDED" },
  moverRow: { display: "flex", alignItems: "center", gap: 12 },
  tableToolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8, padding: "7px 12px", width: 240 },
  searchInput: { border: "none", background: "transparent", color: "#111111", fontSize: 13, outline: "none", flex: 1 },
  tableHint: { fontSize: 11.5, color: "#8A8A8A" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  // Bounded-height scroll box, both axes — deliberately NOT just
  // overflowX:auto: a lone overflow-x implicitly computes overflow-y to
  // "auto" too (CSS spec quirk) but with no height cap the box never
  // actually scrolls vertically, so `position:sticky` inside it has
  // nothing to stick against and silently does nothing. Giving the box a
  // real maxHeight + explicit overflowY makes it the genuine scrolling
  // ancestor sticky needs. Applied to every data table in the app.
  tableScroll: { overflowX: "auto", overflowY: "auto", maxHeight: "65vh" },
  th: { padding: "8px 10px", fontSize: 11, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid #E0E0E0", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#FFFFFF", zIndex: 2 },
  // Sticky first column ("freeze pane") — opt-in per column, not part of
  // the base th/td styles, since only some tables (Vendors) need it.
  // Header corner cell (thStickyCol on a <th>) needs the higher zIndex so
  // it stays above sticky body cells at the top-left intersection.
  thStickyCol: { position: "sticky", left: 0, zIndex: 3, background: "#FFFFFF" },
  tdStickyCol: { position: "sticky", left: 0, zIndex: 1, background: "#FFFFFF" },
  tr: { borderBottom: "1px solid #F0F0F0" },
  td: { padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" },
  editableCell: { cursor: "pointer", borderBottom: "1px dashed #8A8A8A", paddingBottom: 1 },
  inlineInput: { width: 110, background: "#FFFFFF", border: "1px solid #C00000", borderRadius: 5, color: "#111111", padding: "3px 6px", fontSize: 13, textAlign: "right" },
  emptyState: { textAlign: "center", padding: "30px 10px", color: "#6B6B6B" },
  versionRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F0F0F0", border: "1px solid #E0E0E0", borderRadius: 9, padding: "12px 16px" },
  planBtn: { display: "inline-flex", alignItems: "center", background: "#F4F4F4", color: "#333333", border: "1px solid #E0E0E0", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  plannedDot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#C00000", marginLeft: 7, verticalAlign: "middle" },
  chatFab: { position: "fixed", bottom: 22, right: 22, width: 50, height: 50, borderRadius: "50%", background: "#C00000", color: "#FFFFFF", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 20px rgba(192,0,0,0.35)" },
  chatPanel: { width: 340, flexShrink: 0, borderLeft: "1px solid #E0E0E0", background: "#FFFFFF", display: "flex", flexDirection: "column" },
  chatHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #E0E0E0" },
  chatBody: { flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 },
  chatBubbleWrap: { display: "flex", animation: "slideUp .25s ease" },
  chatBubble: { maxWidth: "88%", padding: "9px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.45 },
  chatBubbleUser: { background: "#C00000", color: "#FFFFFF", fontWeight: 500 },
  chatBubbleAssistant: { background: "#F4F4F4", color: "#111111", border: "1px solid #E0E0E0" },
  chatInputRow: { display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid #E0E0E0" },
  chatInput: { flex: 1, background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8, color: "#111111", padding: "9px 12px", fontSize: 13, outline: "none" },
  chatTextarea: { flex: 1, background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 8, color: "#111111", padding: "9px 12px", fontSize: 13, outline: "none", resize: "vertical", minHeight: 60, maxHeight: 220, fontFamily: "inherit", lineHeight: 1.4 },
  chatSendBtn: { background: "#C00000", border: "none", borderRadius: 8, width: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", cursor: "pointer" },
  diffCard: { background: "#FFFFFF", border: "1px solid #C00000", borderRadius: 10, padding: "12px 14px", width: "100%", animation: "slideUp .2s ease" },
  diffLine: { fontSize: 13.5 },
  diffOld: { color: "#6B6B6B", textDecoration: "line-through" },
  diffConfirmBtn: { flex: 1, background: "#C00000", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  diffCancelBtn: { flex: 1, background: "transparent", color: "#6B6B6B", border: "1px solid #E0E0E0", borderRadius: 6, padding: "7px 0", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  modalCard: { background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 12, padding: 22, width: 340, boxShadow: "0 12px 32px rgba(0,0,0,0.15)" },
  modalInput: { width: "100%", background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 7, color: "#111111", padding: "9px 12px", fontSize: 13.5, outline: "none" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#F4F4F4", border: "1px solid #C00000", color: "#111111", padding: "10px 18px", borderRadius: 9, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 60, animation: "slideUp .2s ease" },
  loadErrorBanner: { position: "fixed", top: 0, left: 0, right: 0, background: "#C00000", color: "#FFFFFF", padding: "8px 16px", fontSize: 12.5, textAlign: "center", zIndex: 70 },

  plannerCard: { background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 14, width: "min(920px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" },
  plannerHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #E0E0E0" },
  plannerInputsRow: { display: "flex", gap: 14, padding: "16px 22px", borderBottom: "1px solid #F0F0F0" },
  plannerInputGroup: { display: "flex", flexDirection: "column", gap: 5 },
  plannerLabel: { fontSize: 10.5, color: "#6B6B6B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  plannerInput: { width: 150, background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 7, color: "#111111", padding: "8px 10px", fontSize: 14 },
  plannerBody: { padding: "0 22px 16px", overflowY: "auto", flex: 1 },
  candidateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 },
  candidateCard: { background: "#FFFFFF", border: "1px solid #E0E0E0", borderRadius: 10, padding: "12px 12px" },
  candidateCardShadow: { boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  candidateCardSelected: { border: "1px solid #C00000", background: "#FFF0F0" },
  expandBtn: { marginTop: 8, display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "none", color: "#6B6B6B", fontSize: 10.5, cursor: "pointer", padding: 0 },
  gridHeadCell: { padding: "6px 8px", fontSize: 10.5, color: "#6B6B6B", fontWeight: 600, borderBottom: "1px solid #E0E0E0", whiteSpace: "nowrap" },
  gridRowLabel: { padding: "5px 8px", fontSize: 11, color: "#6B6B6B", fontWeight: 600, borderBottom: "1px solid #F0F0F0", whiteSpace: "nowrap" },
  gridCell: { padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #F0F0F0", cursor: "default", whiteSpace: "nowrap" },
  gridCellInput: { width: 70, background: "#FFFFFF", border: "1px solid #C00000", borderRadius: 4, color: "#111111", padding: "2px 4px", fontSize: 11, textAlign: "right" },
  assistBox: { marginTop: 14, background: "#FAFAFA", border: "1px solid #E0E0E0", borderRadius: 10, padding: 12 },
  dataQualityBanner: { background: "#FFF8E1", border: "1px solid #E8C468", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#8A6D1A", lineHeight: 1.5, marginBottom: 16 },
  plViewToggle: { display: "flex", gap: 6, marginBottom: 14 },
  plToggleBtn: { background: "#FFFFFF", border: "1px solid #E0E0E0", color: "#6B6B6B", borderRadius: 7, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  plToggleBtnActive: { background: "#F4F4F4", color: "#111111", border: "1px solid #C00000" },
  plannerFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", borderTop: "1px solid #E0E0E0", background: "#FAFAFA" },
};
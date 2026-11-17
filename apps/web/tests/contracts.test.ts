import { describe, it, expect } from 'vitest';
import { predictionInputSchema, queryString, summarySchema } from '../src/lib/contracts';
import { compact, propertyLabel } from '../src/lib/utils';
const input={city_slug:'tehran',cat3_slug:'apartment-sell',building_size:90,rooms_count:2,floor:2,total_floors_count:5,construction_year:1395,has_parking:true,has_elevator:true,has_balcony:false,has_warehouse:false};
describe('API boundaries',()=>{
  it('accepts valid normalized prediction fields',()=>expect(predictionInputSchema.safeParse(input).success).toBe(true));
  it('rejects rental categories and Gregorian years',()=>{expect(predictionInputSchema.safeParse({...input,cat3_slug:'apartment-rent'}).success).toBe(false);expect(predictionInputSchema.safeParse({...input,construction_year:2024}).success).toBe(false);});
  it('rejects floors above the total and nonfinite area',()=>{expect(predictionInputSchema.safeParse({...input,floor:9}).success).toBe(false);expect(predictionInputSchema.safeParse({...input,building_size:NaN}).success).toBe(false);});
  it('encodes active filters without empty values',()=>expect(queryString({city:'tehran',search:'a & b',area_min:'',price_min:undefined})).toBe('city=tehran&search=a+%26+b'));
  it('rejects malformed summary responses',()=>expect(summarySchema.safeParse({count:100000}).success).toBe(false));
  it('formats missing values and property labels',()=>{expect(compact(null)).toBe('—');expect(compact(1000000000)).toBe('1B');expect(propertyLabel('apartment-sell')).toBe('Apartment');});
});

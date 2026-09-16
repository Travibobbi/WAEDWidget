package com.waed.widget;
import java.io.IOException;
public class WidgetCsvTest {
 public static void main(String[] args)throws Exception{
  String h="recorded_at,source_timestamp,hospital_name,short_name,triage4_minutes,waiting,total,total_change\r\n";
  String row="2026-09-16T10:00:00+0800,\"Wednesday, 16 September 2026 10:00 AM\",\"Perth Children's Hospital\",PCH,30,4,10,\r\n";
  var rows=WidgetCsv.parse("\uFEFF"+h+row);if(rows.size()!=1||!rows.get(0).get(1).contains(",")||!rows.get(0).get(7).isEmpty())throw new AssertionError("Round-trip fields");
  if(!WidgetCsv.parse(h+row.replace("PCH","\"P\"\"CH\"")).get(0).get(3).equals("P\"CH"))throw new AssertionError("Escaped quote");
  for(String invalid:new String[]{h+row.replace(",30,",",-1,"),h+row.replace(",30,",",NaN,"),h+"\"unterminated",h.replace("total_change","other")+row}){try{WidgetCsv.parse(invalid);throw new AssertionError("Accepted invalid CSV");}catch(IOException expected){}}
  System.out.println("Widget CSV tests passed: quoted timestamps, escaped quotes, BOM/CRLF, null change and invalid input.");
 }
}

package com.waed.widget;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Parser for the existing widget's portable history CSV; does not access the database. */
final class WidgetCsv {
    private static final List<String> HEADER=Arrays.asList("recorded_at","source_timestamp","hospital_name","short_name","triage4_minutes","waiting","total","total_change");
    static List<List<String>> parse(String text) throws IOException {
        if(text.startsWith("\uFEFF"))text=text.substring(1);
        List<List<String>> records=new ArrayList<>();List<String> row=new ArrayList<>();
        StringBuilder field=new StringBuilder();boolean quoted=false,closed=false;
        for(int i=0;i<text.length();i++){
            char c=text.charAt(i);
            if(quoted){
                if(c=='"'){if(i+1<text.length()&&text.charAt(i+1)=='"'){field.append('"');i++;}else{quoted=false;closed=true;}}
                else field.append(c);
            }else if(c=='"'){
                if(field.length()!=0||closed)throw new IOException("Unexpected CSV quote.");quoted=true;
            }else if(c==','||c=='\n'||c=='\r'){
                row.add(field.toString());field.setLength(0);closed=false;
                if(c!=','){if(!(row.size()==1&&row.get(0).isEmpty()))records.add(row);row=new ArrayList<>();if(c=='\r'&&i+1<text.length()&&text.charAt(i+1)=='\n')i++;}
            }else{if(closed)throw new IOException("Unexpected text after CSV quote.");field.append(c);}
        }
        if(quoted)throw new IOException("Unclosed CSV quote.");
        if(field.length()>0||closed||!row.isEmpty()){row.add(field.toString());records.add(row);}
        if(records.isEmpty()||!records.remove(0).equals(HEADER))throw new IOException("Select the CSV from History → Export CSV in WA ED Widget.");
        if(records.isEmpty()||records.size()>200000)throw new IOException("CSV must contain 1–200,000 readings.");
        for(List<String> r:records){
            if(r.size()!=8||r.get(0).isEmpty()||r.get(1).isEmpty()||r.get(2).isEmpty())throw new IOException("Incomplete CSV reading.");
            try{for(int i=4;i<=6;i++)if(Integer.parseInt(r.get(i))<0)throw new NumberFormatException();if(!r.get(7).isEmpty())Integer.parseInt(r.get(7));}
            catch(NumberFormatException e){throw new IOException("Invalid number in CSV reading.");}
        }
        return records;
    }
}

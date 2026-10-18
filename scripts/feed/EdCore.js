/* Portable capture logic: no Drive IDs, credentials, or Google services. */
var EdArchive = (function () {
  'use strict';
  const VERSION = '1.0.0';
  const SOURCE = 'wa-health-ed-daily';
  const REPORT = 'https://app.powerbi.com/view?r=eyJrIjoiYTE4ZThhN2UtYWZjMi00MzExLWEwZmYtNjlkNGJhMWRkMDdkIiwidCI6IjVkMjZiZWI5LWQ3MzAtNDM0My1hMjUxLWQxNzBjYTg2Mzc3YyJ9';
  const KEY = 'a18e8a7e-afc2-4311-a0ff-69d4ba1dd07d'; // Public report ID, not a credential.
  const GROUPS = ['attendance', 'transfer', 'triage'];
  const measures = [
    ['AmbulanceAttendances Field Parameter', 'ambulance_attendances', 'attendance', 'count'],
    ['EDAdmissions Field Parameter', 'ed_admissions', 'attendance', 'count'],
    ['EDAttendances Field Parameter', 'ed_attendances', 'attendance', 'count'],
    ['MTocTime Field Parameter', 'median_transfer_minutes', 'transfer', 'minutes'],
    ['PercAttendTransferredWithin30 Field parameter', 'transfer_within_30_fraction', 'transfer', 'fraction']
  ];
  for (let n = 1; n <= 5; n++) {
    measures.push(['Triage' + n + 'EdAttendances Field Parameter', 'triage_' + n + '_attendances', 'triage', 'count']);
    measures.push(['Triage' + n + 'MedianWaitTime Field Parameter', 'triage_' + n + '_median_wait_minutes', 'triage', 'minutes']);
  }
  const names = [
    ['wa-all', 'All Western Australian public hospitals', 'aggregate'],
    ['wa-metro', 'All metropolitan public hospitals', 'aggregate'],
    ['wa-country', 'All country public hospitals', 'aggregate'],
    ['albany', 'Albany Health Campus'], ['armadale', 'Armadale-Kelmscott Memorial Hospital'],
    ['broome', 'Broome Hospital'], ['bunbury', 'Bunbury Hospital'], ['busselton', 'Busselton Hospital'],
    ['carnarvon', 'Carnarvon Hospital'], ['derby', 'Derby Hospital'], ['esperance', 'Esperance Hospital'],
    ['fiona-stanley', 'Fiona Stanley Hospital'], ['geraldton', 'Geraldton Hospital'], ['hedland', 'Hedland Hospital'],
    ['joondalup', 'Joondalup Health Campus'], ['kalgoorlie', 'Kalgoorlie Hospital'], ['karratha', 'Karratha Hospital'],
    ['king-edward', 'King Edward Memorial Hospital'], ['kununurra', 'Kununurra Hospital'],
    ['narrogin', 'Narrogin Hospital'], ['northam', 'Northam Hospital'], ['peel', 'Peel Health Campus'],
    ['perth-childrens', "Perth Children's Hospital"], ['rockingham', 'Rockingham General Hospital'],
    ['royal-perth', 'Royal Perth Hospital'], ['sir-charles-gairdner', 'Sir Charles Gairdner Hospital'],
    ['midland', 'St John of God Midland Health Campus']
  ];
  const catalog = {
    schema_version: 1, source_id: SOURCE, collector_version: VERSION,
    timezone: 'Australia/Perth', source_url: REPORT,
    attribution: 'Information and System Performance Directorate, Western Australian Department of Health',
    metrics: measures.map(m => ({source_property: m[0], metric_id: m[1], group: m[2], unit: m[3]})),
    establishments: names.map(n => ({establishment_id: n[0], source_name: n[1], kind: n[2] || 'hospital'}))
  };
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function json(value) { return JSON.stringify(value, null, 2) + '\n'; }
  function parsed(text) { return JSON.parse(text.replace(/^\uFEFF/, '')); }
  function cleanPath(path) {
    assert(typeof path === 'string' && path.length && !path.startsWith('/') && !path.includes('\\') &&
      path.split('/').every(p => p && p !== '.' && p !== '..') && !path.includes(':'), 'Unsafe archive path');
    return path;
  }
  function cluster(html) {
    const match = html.match(/var resolvedClusterUri\s*=\s*'(https:\/\/[^']+)'/);
    assert(match, 'Power BI cluster missing');
    const host = match[1].match(/^https:\/\/([a-z0-9-]+)\.analysis\.windows\.net\/?$/i);
    assert(host, 'Unexpected cluster domain');
    return 'https://' + host[1].replace('-redirect', '').replace('global-', '') + '-api.analysis.windows.net';
  }
  function definitions(metadata) {
    const visuals = metadata.exploration.sections.flatMap(s => s.visualContainers);
    const result = {};
    for (const visual of visuals) {
      const config = parsed(visual.config);
      if (config.singleVisual.visualType !== 'pivotTable') continue;
      const q = config.singleVisual.prototypeQuery;
      assert(q && (!q.Where || !q.Where.length), 'Visual filters changed');
      const props = q.Select.filter(x => x.Measure).map(x => x.Measure.Property);
      const group = GROUPS.find(g => {
        const expected = measures.filter(m => m[2] === g).map(m => m[0]);
        return expected.length === props.length && expected.every(p => props.includes(p));
      });
      assert(group && !result[group], 'Metric contract changed or duplicate group');
      assert(q.Select.filter(x => x.Column).map(x => x.Name).sort().join('|') ===
        'Dates.ReportDate|Establishments.EstablishmentName', 'Dimension contract changed');
      result[group] = {query: q, visualId: config.name};
    }
    assert(Object.keys(result).length === 3, 'Expected all three metric groups');
    return result;
  }
  function queryBody(metadata, def) {
    return {version: '1.0.0', modelId: metadata.models[0].id, cancelQueries: [], queries: [{
      QueryId: '', ApplicationContext: {DatasetId: metadata.models[0].dbName,
        Sources: [{ReportId: metadata.exploration.report.objectId, VisualId: def.visualId}]},
      Query: {Commands: [{SemanticQueryDataShapeCommand: {Query: def.query,
        Binding: {Primary: {Groupings: [{Projections: def.query.Select.map((_, i) => i)}]},
          DataReduction: {DataVolume: 3, Primary: {Window: {Count: 10000}}}, Version: 1}, ExecutionMetricsKind: 1}}]}
    }]};
  }
  function decode(response, query) {
    assert(response.results && response.results.length === 1, 'Unexpected result count');
    const result = response.results[0].result;
    assert(result && !result.error && result.data, 'Power BI returned an error');
    const data = result.data;
    assert(data.dsr && data.dsr.DS.length === 1, 'Unexpected data shape');
    const ds = data.dsr.DS[0];
    assert(!ds.RT && ds.PH.length === 1, 'Pagination/partition requires review');
    const rows = ds.PH[0].DM0;
    assert(rows && rows.length && rows.length < 10000, 'Empty or truncated result');
    assert(data.descriptor.Select.length === query.Select.length, 'Column count changed');
    data.descriptor.Select.forEach((s, i) => assert(s.Name === query.Select[i].Name, 'Column order changed'));
    let fields, previous;
    return rows.map(row => {
      assert(Object.keys(row).every(k => ['S', 'C', 'R', 'Ø'].includes(k)), 'Unexpected compressed row');
      if (row.S) fields = row.S;
      assert(fields && fields.length < 31, 'Missing/oversized result schema');
      const repeated = row.R || 0, missing = row['Ø'] || 0;
      assert(Number.isInteger(repeated) && Number.isInteger(missing) && !(repeated & missing) &&
        ((repeated | missing) >>> fields.length) === 0, 'Invalid compression masks');
      let cursor = 0;
      const cells = row.C || [];
      const values = fields.map((f, i) => {
        if (repeated & (1 << i)) { assert(previous, 'Repeat without predecessor'); return previous[i]; }
        if (missing & (1 << i)) return null;
        assert(cursor < cells.length, 'Missing compressed cell');
        return cells[cursor++];
      });
      assert(cursor === cells.length, 'Unconsumed cells');
      previous = values;
      const byName = {};
      fields.forEach((f, i) => {
        let v = values[i];
        if (f.DN && v !== null) {
          const dict = ds.ValueDicts[f.DN];
          assert(dict && Number.isInteger(v) && v >= 0 && v < dict.length, 'Invalid dictionary reference');
          v = dict[v];
        }
        byName[f.N] = v;
      });
      const output = {};
      data.descriptor.Select.forEach((s, i) => {
        let v = byName[s.Value];
        assert(v !== undefined, 'Missing descriptor value');
        if (s.Name === 'Dates.ReportDate') {
          assert(Number.isFinite(v) && v % 86400000 === 0, 'Invalid reporting date');
          v = new Date(v).toISOString().slice(0, 10);
        }
        output[query.Select[i].NativeReferenceName] = v;
      });
      return output;
    });
  }
  function normalize(tables, defs, context) {
    const key = r => r.Date + '|' + r['Establishment Name'];
    const indexed = {};
    for (const group of GROUPS) {
      assert(tables[group] && tables[group].length, 'Missing table ' + group);
      indexed[group] = new Map();
      for (const r of tables[group]) {
        assert(!indexed[group].has(key(r)), 'Duplicate hospital/date');
        assert(names.some(n => n[1] === r['Establishment Name']), 'Unknown establishment; archive retained for review');
        indexed[group].set(key(r), r);
      }
    }
    const base = [...indexed.attendance.keys()].sort();
    assert(base.join('\n') === [...indexed.triage.keys()].sort().join('\n'), 'Attendance/triage coverage differs');
    assert([...indexed.transfer.keys()].every(k => indexed.attendance.has(k)), 'Unexpected transfer dates/hospitals');
    const dates = [...new Set(tables.attendance.map(r => r.Date))].sort();
    assert(dates.length === 8 && (Date.parse(dates[7]) - Date.parse(dates[0])) === 7 * 86400000, 'Expected eight consecutive days');
    assert(dates.every(d => tables.attendance.filter(r => r.Date === d).length === names.length), 'Missing establishment/day');
    const observations = [];
    for (const k of base) {
      const a = indexed.attendance.get(k);
      const establishment = catalog.establishments.find(n => n.source_name === a['Establishment Name']);
      let triageCount = 0;
      for (const m of catalog.metrics) {
        const row = indexed[m.group].get(k);
        const selection = defs[m.group].query.Select.find(s => s.Measure && s.Measure.Property === m.source_property);
        assert(selection, 'Missing metric definition');
        const v = row ? row[selection.NativeReferenceName] : null;
        assert(v !== undefined, 'Missing measure cell');
        assert(v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0), 'Invalid numeric value');
        if (v !== null && m.unit === 'count') assert(Number.isInteger(v), 'Noninteger count');
        if (v !== null && m.unit === 'fraction') assert(v <= 1, 'Percentage out of range');
        if (/^triage_\d_attendances$/.test(m.metric_id)) triageCount += v || 0;
        observations.push({schema_version: 1, source_id: SOURCE, capture_id: context.capture_id,
          captured_at_utc: context.captured_at_utc, source_refresh_utc: context.source_refresh_utc || null,
          reporting_date: a.Date, establishment_id: establishment.establishment_id,
          establishment_name: establishment.source_name, establishment_kind: establishment.kind,
          metric_id: m.metric_id, unit: m.unit, value: v,
          status: !row ? 'not_reported' : v === null ? 'null' : 'reported'});
      }
      assert(triageCount === a['ED Attendances'], 'Triage attendance reconciliation failed');
    }
    return {schema_version: 1, source_id: SOURCE, capture_id: context.capture_id,
      captured_at_utc: context.captured_at_utc, reporting_dates: dates, observations: observations};
  }
  function capture(env) {
    // env: synchronous HTTP, append-only storage, SHA-256 and clock adapters.
    const started = env.now();
    const id = started.replace(/[-:.]/g, '') + '-' + env.uuid();
    const prefix = 'captures/' + started.slice(0, 4) + '/' + started.slice(5, 7) + '/' + id;
    const files = [];
    function save(path, text) {
      cleanPath(path);
      env.writeNew(prefix + '/' + path, text);
      files.push({path: path, sha256: env.sha256(text)});
    }
    function request(name, url, body) {
      if (body) save(name + '.request.json', json(body));
      const result = env.http(url, body, {'X-PowerBI-ResourceKey': KEY, Accept: 'application/json'});
      save(name + '.response.txt', result.text);
      save(name + '.http.json', json({url: url, status: result.status, fetched_at_utc: env.now()}));
      assert(result.status >= 200 && result.status < 300, 'HTTP ' + result.status + ' for ' + name);
      return result.text;
    }
    const manifest = {schema_version: 1, collector_version: VERSION, source_id: SOURCE,
      source_url: REPORT, capture_id: id, captured_at_utc: started, files: files};
    let complete = false;
    try {
      save('catalog.json', json(catalog));
      const api = cluster(request('report', REPORT));
      const metadataUrl = api + '/public/reports/' + KEY + '/modelsAndExploration?preferReadOnlySession=true';
      const metadata = parsed(request('metadata-before', metadataUrl));
      const defs = definitions(metadata), tables = {};
      manifest.source_refresh_utc = metadata.models[0].lastRefreshTime || null;
      for (const group of GROUPS) {
        const raw = parsed(request(group, api + '/public/reports/querydata', queryBody(metadata, defs[group])));
        tables[group] = decode(raw, defs[group].query);
        save(group + '.json', json(tables[group]));
      }
      const after = parsed(request('metadata-after', metadataUrl));
      assert(metadata.models[0].id === after.models[0].id &&
        manifest.source_refresh_utc === (after.models[0].lastRefreshTime || null) &&
        metadata.models[0].packageVersion === after.models[0].packageVersion, 'Source refreshed mid-capture; retry');
      const normalized = normalize(tables, defs, manifest);
      save('observations.json', json(normalized));
      const lastDate = normalized.reporting_dates[7];
      const age = (Date.parse(started) - Date.parse(lastDate + 'T00:00:00+08:00')) / 86400000;
      manifest.status = 'complete';
      manifest.reporting_dates = normalized.reporting_dates;
      manifest.observation_count = normalized.observations.length;
      manifest.warnings = age > 3 ? ['Latest reporting date is more than three days old'] : [];
      manifest.completed_at_utc = env.now();
      env.writeNew(prefix + '/manifest.json', json(manifest)); // Commit marker written last.
      complete = true;
      env.publishLatest({schema_version: 1, source_id: SOURCE, capture_id: id,
        captured_at_utc: started, manifest_path: prefix + '/manifest.json',
        observations_path: prefix + '/observations.json', warnings: manifest.warnings});
      return manifest;
    } catch (error) {
      if (!complete) {
        manifest.status = 'failed'; manifest.error = String(error.message || error);
        manifest.completed_at_utc = env.now();
        env.writeNew(prefix + '/manifest.json', json(manifest));
      }
      throw error; // Let Apps Script mark the execution failed; no fabricated success.
    }
  }
  return {VERSION, SOURCE, REPORT, KEY, GROUPS, catalog, json, parsed, cleanPath,
    definitions, queryBody, decode, normalize, capture};
})();
if (typeof module !== 'undefined') module.exports = EdArchive;

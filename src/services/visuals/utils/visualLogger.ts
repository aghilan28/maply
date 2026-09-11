/**
 * Maply — Visual Resolution Development Diagnostics Logger
 * 
 * Outputs clean, structured diagnostic logs in development mode.
 * Silent in production to prevent console spam.
 */

import { PlaceVisual } from '../../../types/visual';

export interface ProviderDiagnosticLog {
  provider: 'Wikimedia' | 'Foursquare' | 'Official' | 'Mapbox';
  status: 'attempted' | 'skipped' | 'success' | 'failed' | 'rejected';
  details?: string;
  confidence?: number;
  browserLoad?: 'success' | 'failed' | 'pending' | 'bypassed';
  reason?: string;
}

export function logVisualResolutionDiagnostic(
  placeName: string,
  logs: ProviderDiagnosticLog[],
  result: PlaceVisual | null
) {
  // Only log in development environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && !import.meta.env.DEV) {
    return;
  }

  try {
    let output = `[Maply VisualResolver]\nPlace: ${placeName}\n\n`;

    for (const log of logs) {
      output += `${log.provider}:\n`;
      if (log.status === 'skipped') {
        output += `  status: skipped (${log.reason || 'not configured'})\n`;
      } else if (log.status === 'success') {
        output += `  candidate found\n`;
        if (log.confidence !== undefined) {
          output += `  confidence: ${log.confidence.toFixed(2)}\n`;
        }
        if (log.browserLoad) {
          output += `  browser load: ${log.browserLoad}\n`;
        }
        if (log.details) {
          output += `  details: ${log.details}\n`;
        }
      } else {
        output += `  status: ${log.status}\n`;
        if (log.reason) {
          output += `  reason: ${log.reason}\n`;
        }
      }
      output += `\n`;
    }

    if (result) {
      output += `Result:\n  source: ${result.source}\n  type: ${result.type}\n  confidence: ${result.confidence.toFixed(2)}`;
    } else {
      output += `Result:\n  source: none (Photo unavailable)\n  type: none`;
    }

    console.log(output);
  } catch {
    // Fail-safe
  }
}

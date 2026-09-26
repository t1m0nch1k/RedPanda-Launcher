import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCrashLogs } from '../src/utils/crashDiagnostics.ts';

test('diagnoses Java version mismatch (UnsupportedClassVersionError)', () => {
  const logs = [
    { stream: 'Stdout', line: '[main/INFO]: Loading Minecraft 1.21...' },
    { 
      stream: 'Stderr', 
      line: 'Exception in thread "main" java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version of the Java Runtime Environment (class file version 65.0), this version of the Java Runtime Environment only recognizes class file versions up to 52.0' 
    }
  ];

  const diag = analyzeCrashLogs(logs);
  assert.equal(diag.type, 'java_version');
  assert.equal(diag.severity, 'critical');
  assert.ok(diag.message.includes('Java 21+'));
  assert.ok(diag.message.includes('Java 8'));
  assert.equal(diag.action?.type, 'open_settings_java');
});

test('diagnoses Out of Memory (OOM)', () => {
  const logs = [
    { stream: 'Stderr', line: 'java.lang.OutOfMemoryError: Java heap space' }
  ];

  const diag = analyzeCrashLogs(logs);
  assert.equal(diag.type, 'out_of_memory');
  assert.equal(diag.severity, 'critical');
  assert.equal(diag.action?.type, 'open_settings_memory');
});

test('diagnoses OOM from Windows exit code -1073740791', () => {
  const diag = analyzeCrashLogs([], -1073740791);
  assert.equal(diag.type, 'out_of_memory');
  assert.equal(diag.severity, 'critical');
});

test('diagnoses GLFW OpenGL graphic driver failure', () => {
  const logs = [
    { stream: 'Stderr', line: '[Render thread/ERROR]: GLFW error 65542: WGL: The driver does not appear to support OpenGL' }
  ];

  const diag = analyzeCrashLogs(logs);
  assert.equal(diag.type, 'graphics_driver');
  assert.equal(diag.action?.type, 'open_url');
});

test('diagnoses Fabric mod incompatibilities and missing dependencies', () => {
  const logs = [
    { stream: 'Stderr', line: 'net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the work or each other' },
    { stream: 'Stderr', line: "\t- Mod 'create' (0.5.1) requires version 0.90+ of 'fabric-api', which is missing!" }
  ];

  const diag = analyzeCrashLogs(logs);
  assert.equal(diag.type, 'missing_fabric_deps');
  assert.equal(diag.action?.type, 'open_mods');
  assert.ok(diag.details && diag.details.length > 0);
});

test('diagnoses UnsatisfiedLinkError for missing native libraries (VC++ Redist)', () => {
  const logs = [
    { stream: 'Stderr', line: 'java.lang.UnsatisfiedLinkError: Can\'t find dependent libraries (org.lwjgl.system.windows.WindowsLibrary)' }
  ];

  const diag = analyzeCrashLogs(logs);
  assert.equal(diag.type, 'native_library');
  assert.equal(diag.action?.type, 'open_url');
});

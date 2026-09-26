export interface CrashDiagnostic {
  type: 
    | "java_version" 
    | "out_of_memory" 
    | "missing_fabric_deps" 
    | "mod_conflict" 
    | "graphics_driver" 
    | "corrupted_files" 
    | "missing_main_class" 
    | "native_library" 
    | "mixin_error" 
    | "unknown";
  severity: "critical" | "warning";
  title: string;
  message: string;
  solution: string;
  action?: {
    type: "open_settings_memory" | "open_settings_java" | "open_mods" | "open_folder" | "open_url";
    label: string;
    url?: string;
  };
  details?: string[];
}

function parseJavaClassVersion(classVerStr: string): string {
  const num = parseFloat(classVerStr);
  if (num >= 65) return "Java 21+";
  if (num >= 61) return "Java 17";
  if (num >= 60) return "Java 16";
  if (num >= 55) return "Java 11";
  if (num >= 52) return "Java 8";
  return `Java (class ${classVerStr})`;
}

export function analyzeCrashLogs(
  logs: { stream: string; line: string }[],
  exitCode?: number | null
): CrashDiagnostic {
  if (!logs || logs.length === 0) {
    if (exitCode !== undefined && exitCode !== null && exitCode !== 0) {
      if (exitCode === -1073740791 || exitCode === 3221225477 || exitCode === 137) {
        return {
          type: "out_of_memory",
          severity: "critical",
          title: "Нехватка оперативной памяти (OOM)",
          message: `Процесс завершился с кодом ${exitCode}, что указывает на экстренное завершение из-за переполнения памяти.`,
          solution: "Выделите больше оперативной памяти (RAM) в настройках лаунчера (рекомендуется от 4 до 6 ГБ).",
          action: {
            type: "open_settings_memory",
            label: "Настройки памяти"
          }
        };
      }
      return {
        type: "unknown",
        severity: "warning",
        title: `Игра завершилась с кодом ${exitCode}`,
        message: "Логи пусты. Игра закрылась на самом раннем этапе до вывода в консоль.",
        solution: "Проверьте путь к Java в настройках или попробуйте перезапустить лаунчер от имени администратора.",
        action: {
          type: "open_settings_java",
          label: "Настройки Java"
        }
      };
    }

    return {
      type: "unknown",
      severity: "warning",
      title: "Неизвестная ошибка",
      message: "Логи игры пусты.",
      solution: "Попробуйте запустить игру снова или проверьте системные логи."
    };
  }

  const allLines = logs.map(l => l.line);
  const fullText = allLines.join("\n");

  // 1. UnsupportedClassVersionError (Java Version Mismatch)
  const javaVersionMatch = fullText.match(
    /UnsupportedClassVersionError:.*class file version (\d+\.\d+).*recognizes class file versions up to (\d+\.\d+)/i
  );
  if (javaVersionMatch) {
    const requiredVer = parseJavaClassVersion(javaVersionMatch[1]);
    const currentVer = parseJavaClassVersion(javaVersionMatch[2]);
    return {
      type: "java_version",
      severity: "critical",
      title: "Несовпадение версии Java",
      message: `Игра или один из модов скомпилированы под ${requiredVer}, а запуск был произведён на ${currentVer}.`,
      solution: `Установите и выберите в настройках лаунчера версию ${requiredVer} (для Minecraft 1.20.5+ требуется Java 21, для 1.17-1.20.4 — Java 17, для 1.16.5 и ниже — Java 8).`,
      action: {
        type: "open_settings_java",
        label: "Выбрать Java в настройках"
      },
      details: [
        `Требуется: ${requiredVer} (class ${javaVersionMatch[1]})`,
        `Текущая: ${currentVer} (class ${javaVersionMatch[2]})`
      ]
    };
  }

  // 2. Out of Memory (OOM)
  const oomMatch = fullText.match(
    /(java\.lang\.OutOfMemoryError|OutOfMemoryError: Java heap space|OutOfMemoryError: Metaspace|insufficient memory for the Java Runtime Environment)/i
  );
  if (oomMatch || exitCode === -1073740791 || exitCode === 3221225477 || exitCode === 137) {
    return {
      type: "out_of_memory",
      severity: "critical",
      title: "Нехватка оперативной памяти (RAM)",
      message: "Minecraft исчерпал выделенную память кучи Java (Heap Space) и был аварийно остановлен.",
      solution: "Откройте настройки лаунчера или сборки и увеличьте лимит оперативной памяти (например, до 4096 МБ или 6144 МБ для сборок с модами).",
      action: {
        type: "open_settings_memory",
        label: "Увеличить RAM"
      }
    };
  }

  // 3. Missing Main Class (KnotClient / Main class not found)
  if (/Could not find or load main class (net\.fabricmc\.loader\.impl\.launch\.knot\.KnotClient|net\.minecraft\.client\.main\.Main)/i.test(fullText)) {
    return {
      type: "missing_main_class",
      severity: "critical",
      title: "Не найден основной класс загрузчика",
      message: "Лаунчер не смог запустить KnotClient или Main. Обычно это происходит при неполной загрузке библиотек Fabric или кириллических символах в пути.",
      solution: "Убедитесь, что в пути к игре нет повреждённых файлов, или переустановите сборку.",
      action: {
        type: "open_folder",
        label: "Открыть папку сборки"
      }
    };
  }

  // 4. Fabric Mod Incompatibility / Missing Dependencies
  if (
    /net\.fabricmc\.loader\.impl\.FormattedException: Some of your mods are incompatible/i.test(fullText) ||
    /net\.fabricmc\.loader\.impl\.discovery\.ModResolutionException/i.test(fullText) ||
    /IncompatibleModException/i.test(fullText)
  ) {
    const conflictLines = allLines
      .filter(l => /requires .* of |Unmet dependency|Conflicting versions|Mod .* is incompatible with/i.test(l))
      .slice(0, 5)
      .map(l => l.trim().replace(/^-\s*/, ""));

    return {
      type: "missing_fabric_deps",
      severity: "critical",
      title: "Конфликт или отсутствие зависимостей Fabric",
      message: "Один или несколько модов требуют отсутствующую библиотеку (например, Fabric API) или конфликтуют между собой.",
      solution: "Проверьте зависимости сбойных модов во вкладке 'Моды'. Чаще всего требуется установить Fabric API соответствующей версии игры.",
      action: {
        type: "open_mods",
        label: "Управление модами"
      },
      details: conflictLines.length > 0 ? conflictLines : undefined
    };
  }

  // 5. Forge / NeoForge Loading Exception
  if (
    /net\.minecraftforge\.fml\.LoadingFailedException/i.test(fullText) ||
    /net\.neoforged\.fml\.ModLoadingException/i.test(fullText) ||
    /Multiple mods have loaded the same class/i.test(fullText) ||
    /Failed to complete early initialization/i.test(fullText)
  ) {
    const errorDetails = allLines
      .filter(l => /ModLoadingException|Missing or unsupported mandatory dependencies|Requires .* but/i.test(l))
      .slice(0, 4)
      .map(l => l.trim());

    return {
      type: "mod_conflict",
      severity: "critical",
      title: "Ошибка загрузки модов Forge / NeoForge",
      message: "Загрузчик Forge не смог запустить один или несколько установленных модов.",
      solution: "Отключите недавно добавленные моды во вкладке управления сборкой и проверьте совместимость с версией загрузчика.",
      action: {
        type: "open_mods",
        label: "Открыть менеджер модов"
      },
      details: errorDetails.length > 0 ? errorDetails : undefined
    };
  }

  // 6. Graphics Driver / OpenGL / GLFW 65542
  if (
    /GLFW error 65542: WGL/i.test(fullText) ||
    /Pixel format not accelerated/i.test(fullText) ||
    /The driver does not appear to support OpenGL/i.test(fullText) ||
    /org\.lwjgl\.LWJGLException: Pixel format not accelerated/i.test(fullText)
  ) {
    return {
      type: "graphics_driver",
      severity: "critical",
      title: "Ошибка видеодрайвера (OpenGL)",
      message: "Видеокарта не поддерживает требуемую версию OpenGL, либо в системе не установлен официальный графический драйвер.",
      solution: "Обновите драйверы видеокарты с сайта NVIDIA, AMD или Intel. Если у вас две видеокарты, настройте запуск Java на дискретной видеокарте в параметрах Windows.",
      action: {
        type: "open_url",
        label: "Инструкция по драйверам",
        url: "https://help.minecraft.net/hc/en-us/articles/4409137348877"
      }
    };
  }

  // 7. UnsatisfiedLinkError / Native Library
  if (/java\.lang\.UnsatisfiedLinkError/i.test(fullText)) {
    const isVCRedist = /Can't find dependent libraries/i.test(fullText) || /lwjgl\.dll/i.test(fullText);
    return {
      type: "native_library",
      severity: "critical",
      title: "Ошибка нативных библиотек LWJGL",
      message: "Система не смогла загрузить нативные C++ библиотеки Minecraft (lwjgl.dll / glfw.dll).",
      solution: isVCRedist 
        ? "Чаще всего это происходит из-за отсутствия Visual C++ Runtime. Установите Microsoft Visual C++ 2015-2022 x64."
        : "Проверьте, что путь к сборке не содержит спецсимволов и антивирус не блокирует системные DLL.",
      action: {
        type: "open_url",
        label: "Скачать VC++ Redistributable",
        url: "https://aka.ms/vs/17/release/vc_redist.x64.exe"
      }
    };
  }

  // 8. Mixin Injection / Transformer Error
  if (
    /org\.spongepowered\.asm\.mixin\.transformer\.throwables\.MixinTransformerError/i.test(fullText) ||
    /org\.spongepowered\.asm\.mixin\.injection\.throwables\.InjectionError/i.test(fullText)
  ) {
    const mixinMatch = fullText.match(/\[([a-zA-Z0-9_\-.]+\.mixins\.json):/);
    const culprit = mixinMatch ? mixinMatch[1] : null;

    return {
      type: "mixin_error",
      severity: "critical",
      title: "Конфликт Mixin в одном из модов",
      message: culprit 
        ? `Мод с конфигурацией [${culprit}] попытался изменить код игры, но метод не совпал с установленной версией.`
        : "Один из установленных модов несовместим с версией Minecraft или конфликтует с другим модом.",
      solution: "Обновите или временно отключите несовместимый мод.",
      action: {
        type: "open_mods",
        label: "Перейти к модам"
      },
      details: culprit ? [`Конфиг Mixin: ${culprit}`] : undefined
    };
  }

  // 9. Corrupted Save / Options
  if (/Failed to load level dat|Error reading level\.dat/i.test(fullText)) {
    return {
      type: "corrupted_files",
      severity: "warning",
      title: "Поврежден файл сохранения мира",
      message: "Minecraft не может прочитать файл level.dat выбранного мира.",
      solution: "Перейдите в папку saves, найдите папку мира и переименуйте level.dat_old в level.dat.",
      action: {
        type: "open_folder",
        label: "Открыть папку сборки"
      }
    };
  }

  // Fallback: check exit code or last stderr lines
  const stderrLines = logs.filter(l => l.stream === "Stderr").slice(-3).map(l => l.line);

  return {
    type: "unknown",
    severity: "warning",
    title: exitCode ? `Игра завершилась с ошибкой (код ${exitCode})` : "Игра неожиданно завершила работу",
    message: stderrLines.length > 0 
      ? `Последняя ошибка: ${stderrLines[stderrLines.length - 1]}`
      : "Не удалось автоматически определить причину падения. Ознакомьтесь с полным журналом ниже.",
    solution: "Скопируйте логи игры и обратитесь за помощью в сообщество поддержки RedPanda.",
    action: {
      type: "open_folder",
      label: "Открыть папку сборки"
    },
    details: stderrLines.length > 0 ? stderrLines : undefined
  };
}

figma.showUI(__html__);

function showNotify (text: string) {
	figma.notify(text);
}

figma.ui.onmessage = async (e) => {
  if (e.type === "EXPORT") {
    await exportToJSON();
  }

  if (e.type === "SHOW_NOTIFY") {
	showNotify(e.data)
  }
};

async function exportToJSON() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const files = [];
  for (const collection of collections) {
    files.push(...(await processCollection(collection)));
  }
  figma.ui.postMessage({ type: "EXPORT_RESULT", files });
  showNotify("Json ready. Press save to get file :)");
}

type TFileBody = Record<string, never | VariableValue | Record<string, never>>;
type TFile = {
  fileName: string;
  body: TFileBody;
};

function isVariableAlias(value: VariableValue): value is VariableAlias {
  return !!(value as VariableAlias).type;
}

async function processCollection({
  name,
  modes,
  variableIds,
}: VariableCollection): Promise<TFile[]> {
  const files: TFile[] = [];

  for (const mode of modes) {
    const file: TFile = {
      fileName: `${name}.${mode.name}.tokens.json`,
      body: {},
    };

    for (const variableId of variableIds) {
      const { name, resolvedType, valuesByMode } =
        (await figma.variables.getVariableByIdAsync(variableId)) as Variable;
      const value = valuesByMode[mode.modeId];

      if (value !== undefined && ["COLOR", "FLOAT"].includes(resolvedType)) {
        let obj = file.body;

        name.split("/").forEach((groupName) => {
          obj[groupName] = obj[groupName] || {};
          obj = obj[groupName] as TFileBody;
        });

        obj.$type = resolvedType === "COLOR" ? "color" : "number";

        if (isVariableAlias(value) && value.type === "VARIABLE_ALIAS") {
          const currentVar = await figma.variables.getVariableByIdAsync(
            value.id
          );
          if (currentVar) {
            obj.$value = `{${currentVar.name.replace(/\//g, ".")}}`;
          }
        } else {
          obj.$value =
            resolvedType === "COLOR" ? rgbToHex(value as RGBA) : value;
        }
      }
    }

    files.push(file);
  }

  return files;
}

function rgbToHex({ r, g, b, a }: RGBA) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}

// Add the generateConfig function from previous answers here

function generateConfig(sourceService, destinationService, policies) {
  const applicablePolicies = policies.filter((policy) => {
    const targetRef = policy.spec.targetRef;
    return (
      (targetRef.kind === 'Mesh') ||
      (targetRef.kind === 'MeshService' && targetRef.name === sourceService)
    );
  });

  applicablePolicies.sort((a, b) => {
    const priority = {
      Mesh: 1,
      MeshSubset: 2,
      MeshService: 3,
      MeshServiceSubset: 4,
      MeshGatewayRoute: 5,
    };
  
    const aPriority = priority[a.spec.targetRef.kind];
    const bPriority = priority[b.spec.targetRef.kind];
  
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  const finalConfig = {};

  applicablePolicies.forEach((policy) => {
    const policyConfig = policy.spec.to.find(
      (to) => (
        (to.targetRef.kind === 'MeshService' && to.targetRef.name === destinationService) ||
        (to.targetRef.kind === 'Mesh')
      )
    )?.default;

    if (!policyConfig) return;

    deepMerge(finalConfig, policyConfig);
  });

  return finalConfig;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function deepMerge(target, source) {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

const policiesEditor = CodeMirror(document.getElementById('policies'), {
  mode: 'yaml',
  lineNumbers: true,
});
const resultEditor = CodeMirror(document.getElementById('result'), {
  mode: 'yaml',
  lineNumbers: true,
  readOnly: true,
});

policiesEditor.setSize(null, "80vh");
resultEditor.setSize(null, "80vh");

policiesEditor.on('change', onChange);

policiesEditor.setValue(`type: MeshTimeout
name: timeout-global
mesh: default
spec:
  targetRef:
    kind: Mesh
  to:
    - targetRef:
        kind: Mesh
      default:
        idleTimeout: 20s
        connectionTimeout: 2s
        http:
          requestTimeout: 3s
---
type: MeshTimeout
name: web-timeouts
mesh: default
spec:
  targetRef:
    kind: Mesh
    name: web
  to:
    - targetRef:
        kind: MeshService
        name: backend
      default:
        idleTimeout: 10s
        http:
          requestTimeout: 5s`)


const sourceServiceInput = document.getElementById('sourceService');
const destinationServiceInput = document.getElementById('destinationService');

sourceServiceInput.addEventListener('input', onChange);
destinationServiceInput.addEventListener('input', onChange);

function onChange() {
  const policiesYaml = policiesEditor.getValue();
  const sourceService = document.getElementById('sourceService').value;
  const destinationService = document.getElementById('destinationService').value;

  const policyStrings = policiesYaml.split('---');
  const policies = policyStrings.map((policyString) => jsyaml.load(policyString));

  const config = generateConfig(sourceService, destinationService, policies);
  const yamlConfig = jsyaml.dump(config);

  resultEditor.setValue(yamlConfig);
}
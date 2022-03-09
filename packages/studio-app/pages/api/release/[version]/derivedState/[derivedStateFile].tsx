import { NextApiHandler } from 'next';
import { transform } from 'sucrase';
import * as path from 'path';
import { loadReleaseDom } from '../../../../../src/server/data';
import { NodeId } from '../../../../../src/types';
import * as studioDom from '../../../../../src/studioDom';
import { asArray } from '../../../../../src/utils/collections';
import { getCapabilities } from '../../../../../src/capabilities';

export default (async (req, res) => {
  const capabilities = await getCapabilities(req);
  if (!capabilities?.view) {
    res.status(403).end();
    return;
  }

  const [version] = asArray(req.query.version);
  const [derivedStateFile] = asArray(req.query.derivedStateFile);

  const { name: stateId } = path.parse(derivedStateFile);

  const dom = await loadReleaseDom(version);

  const derivedState = studioDom.getMaybeNode(dom, stateId as NodeId, 'derivedState');

  if (!derivedState) {
    res.status(404);
    res.end();
    return;
  }

  const { code: compiled } = transform(derivedState.attributes.code.value, {
    transforms: ['jsx', 'typescript'],
  });

  res.setHeader('content-type', 'application/javascript');
  res.send(compiled);
}) as NextApiHandler<string>;

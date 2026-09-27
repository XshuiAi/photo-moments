import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

skill=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('creator',skill/'scripts/create_project.py')
creator=importlib.util.module_from_spec(spec);spec.loader.exec_module(creator)

class PathTests(unittest.TestCase):
 def setUp(self):
  self.old=Path.cwd();self.work=Path(tempfile.mkdtemp(prefix='photo-moments-test-'));os.chdir(self.work)
 def tearDown(self):os.chdir(self.old)
 def test_invalid_names_before_write(self):
  for name in ['.','..','/','~',str(self.work),str(skill),str(skill.parent),str(creator.TEMPLATE),'../escape','a/../../b','a\\b','CON','con','--force','$(touch hacked)','bad\nname']:
   with self.assertRaises(ValueError):creator.create(name)
   self.assertEqual(list(self.work.iterdir()),[])
 def test_existing_directory_unchanged(self):
  target=self.work/'photo-moments-output'/'existing';target.mkdir(parents=True);(target/'keep').write_text('original')
  with self.assertRaises(ValueError):creator.create('existing')
  self.assertEqual((target/'keep').read_text(),'original');self.assertEqual(len(list(target.iterdir())),1)
 def test_symlink_root(self):
  (self.work/'photo-moments-output').symlink_to(self.work,target_is_directory=True)
  with self.assertRaises(ValueError):creator.create('link')
  self.assertEqual(len(list(self.work.iterdir())),1)
 def test_symlink_destination(self):
  root=self.work/'photo-moments-output';root.mkdir();(root/'link').symlink_to(self.work,target_is_directory=True)
  with self.assertRaises(ValueError):creator.create('link')
  self.assertEqual(len(list(root.iterdir())),1)
 def test_skill_and_template_cwd(self):
  for cwd in [skill,creator.TEMPLATE,skill/'scripts']:
   os.chdir(cwd)
   with self.assertRaises(ValueError):creator.create('bad')
 def test_validation_failure_preserves_files(self):
  sentinel=self.work/'keep';sentinel.write_text('original')
  old=creator.TEMPLATE
  try:
   creator.TEMPLATE=self.work/'missing'
   with self.assertRaises(ValueError):creator.create('failure')
  finally:creator.TEMPLATE=old
  self.assertEqual(list(self.work.iterdir()),[sentinel]);self.assertEqual(sentinel.read_text(),'original')
 def test_interruption_preserves_existing_files(self):
  sentinel=self.work/'keep';sentinel.write_text('original')
  real_open=Path.open
  def interrupted(path,*args,**kwargs):
   if args and args[0]=='xb':raise KeyboardInterrupt()
   return real_open(path,*args,**kwargs)
  with patch.object(Path,'open',interrupted):
   with self.assertRaises(KeyboardInterrupt):creator.create('interrupted')
  self.assertEqual(sentinel.read_text(),'original')
  self.assertFalse((self.work/'photo-moments-output/interrupted').exists())
 def test_success(self):
  result=creator.create('example')
  self.assertTrue((result/'index.html').is_file());self.assertTrue((result/'assets/portraits.png').is_file())
  self.assertTrue((result/'.photo-moments-output.json').is_file())
  with self.assertRaises(ValueError):creator.create('example')
  print('Verified copy:',result)

if __name__=='__main__':unittest.main()
